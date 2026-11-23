import unittest
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.dependencies import get_assistant_service
from src.api.v1.chat import router as chat_router
from src.api.v1.sources import router as sources_router
from src.application.assistant_service import AssistantResult
from src.core.security import create_session_token
from src.db.base import Base
from src.db.chat_conversation_models import ChatConversationRecord, ChatConversationTurnRecord
from src.db.chat_evidence_models import ChatEvidenceAssessmentRecord
from src.db.models import ChatThreadRecord, User
from src.db.session import get_db
from src.ports.conversation_history import ConversationTurn
from src.ports.llm import LLMUnavailableError
from src.schemas.retrieval import (
    ClaimEvidenceAssociation,
    ExternalCitation,
    GeneratedClaim,
)


class FakeAssistantService:
    def __init__(self):
        self.fail = False
        self.calls = []
        self.history_calls = []

    def generate(
        self,
        *,
        question: str,
        course_id: str | None = None,
        hint_level: int | None = None,
        history: list[ConversationTurn] | None = None,
    ) -> AssistantResult:
        if self.fail:
            raise LLMUnavailableError("Test connection failure")

        self.calls.append((question, course_id))
        self.history_calls.append(list(history or []))

        if course_id:
            citation = ExternalCitation(
                evidence_id="external:searxng:test",
                claim_ids=["claim-1"],
                provider="searxng",
                title="Test Source",
                url=f"https://example.com/source/{len(self.calls)}",
            )
            claim = GeneratedClaim(
                claim_id="claim-1",
                text="A supported test claim.",
                evidence=[
                    ClaimEvidenceAssociation(
                        evidence_id="external:searxng:test",
                        relationship="supports",
                        confidence=0.9,
                    )
                ],
            )
            return AssistantResult(
                answer=f"Generated answer: {question}",
                mode="course",
                citations=[citation],
                claims=[claim],
                evidence_status="sufficient",
            )

        return AssistantResult(
            answer=f"Generated answer: {question}",
            mode="general",
            citations=[],
        )


class TestChatAPI(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.fake_assistant_service = FakeAssistantService()

        with self.session_factory() as db:
            db.add_all([
                User(
                    user_id=1,
                    user_first_name="First",
                    user_last_name="Student",
                    user_email="first@example.com",
                    password_hash="unused-test-hash",
                ),
                User(
                    user_id=2,
                    user_first_name="Second",
                    user_last_name="Student",
                    user_email="second@example.com",
                    password_hash="unused-test-hash",
                ),
            ])
            db.commit()

        app = FastAPI()
        app.include_router(chat_router, prefix="/api/v1")
        app.include_router(sources_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = self.get_test_db
        app.dependency_overrides[get_assistant_service] = lambda: self.fake_assistant_service

        self.client = TestClient(app)
        self.authenticate(1)

    def get_test_db(self):
        with self.session_factory() as db:
            yield db

    def authenticate(self, user_id: int):
        self.client.cookies.set("studysync_session", create_session_token(user_id))

    def create_chat(self, question: str, course_id: str | None = None, conversation_id: str | None = None):
        payload = {"question": question}
        if course_id is not None:
            payload["course_id"] = course_id
        if conversation_id is not None:
            payload["conversation_id"] = conversation_id
        return self.client.post("/api/v1/chat", json=payload)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_chat_generation_and_evidence_persistence(self):
        response = self.create_chat("What is a process?", course_id="CS537")

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(
            self.fake_assistant_service.calls,
            [("What is a process?", "CS537")],
        )
        self.assertEqual(self.fake_assistant_service.history_calls, [[]])
        self.assertEqual(data["mode"], "course")
        self.assertEqual(data["evidence_status"], "sufficient")
        self.assertEqual(data["citations"][0]["evidence_id"], "external:searxng:test")
        self.assertEqual(data["citations"][0]["claim_ids"], ["claim-1"])
        self.assertEqual(data["claims"][0]["claim_id"], "claim-1")

        saved = self.client.get(f"/api/v1/chat/{data['chat_id']}")

        self.assertEqual(saved.status_code, 200)
        self.assertEqual(saved.json()["answer"], data["answer"])
        self.assertEqual(saved.json()["conversation_id"], data["conversation_id"])
        self.assertEqual(saved.json()["citations"], data["citations"])
        self.assertEqual(saved.json()["claims"], data["claims"])
        self.assertEqual(len(saved.json()["messages"]), 2)

        source = self.client.get("/api/v1/sources/external:searxng:test")
        self.assertEqual(source.status_code, 200)
        self.assertEqual(source.json()["evidence_id"], "external:searxng:test")

        with self.session_factory() as db:
            conversation = db.get(ChatConversationRecord, data["conversation_id"])
            self.assertEqual(conversation.user_id, 1)
            assessment = db.scalar(
                select(ChatEvidenceAssessmentRecord).where(
                    ChatEvidenceAssessmentRecord.chat_id == data["chat_id"]
                )
            )
            self.assertIsNotNone(assessment)

    def test_unavailable_llm_does_not_create_chat(self):
        self.fake_assistant_service.fail = True

        response = self.create_chat("What is a process?", course_id="CS537")
        self.assertEqual(response.status_code, 503)

        with self.session_factory() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(ChatThreadRecord)), 0)
            self.assertEqual(db.scalar(select(func.count()).select_from(ChatConversationRecord)), 0)

    def test_general_chat_without_course(self):
        response = self.create_chat("Who developed the theory of relativity?")

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["mode"], "general")
        self.assertEqual(data["evidence_status"], "not_applicable")
        self.assertEqual(data["citations"], [])
        self.assertEqual(data["claims"], [])
        self.assertTrue(data["conversation_id"])
        self.assertEqual(self.fake_assistant_service.history_calls, [[]])

    def test_continuation_preserves_conversation_id(self):
        first = self.create_chat("Pizza is my favorite food.").json()
        second_response = self.create_chat(
            "What is my favorite food?",
            conversation_id=first["conversation_id"],
        )

        self.assertEqual(second_response.status_code, 201)
        second = second_response.json()
        self.assertEqual(first["conversation_id"], second["conversation_id"])
        self.assertNotEqual(first["chat_id"], second["chat_id"])

        with self.session_factory() as db:
            chat_ids = db.scalars(
                select(ChatConversationTurnRecord.chat_id)
                .where(ChatConversationTurnRecord.conversation_id == first["conversation_id"])
                .order_by(ChatConversationTurnRecord.id)
            ).all()

        self.assertEqual(chat_ids, [first["chat_id"], second["chat_id"]])
        self.assertEqual(len(self.fake_assistant_service.calls), 2)
        self.assertEqual(self.fake_assistant_service.history_calls, [
            [],
            [
                ConversationTurn(
                    question="Pizza is my favorite food.",
                    answer="Generated answer: Pizza is my favorite food.",
                )
            ],
        ])

    def test_new_chat_creates_a_separate_conversation(self):
        first = self.create_chat("First question").json()
        second = self.create_chat("Second question").json()

        self.assertNotEqual(first["conversation_id"], second["conversation_id"])
        self.assertEqual(self.fake_assistant_service.history_calls, [[], []])

    def test_unauthenticated_requests_are_rejected(self):
        created = self.create_chat("Private question", course_id="CS537").json()
        self.client.cookies.clear()

        self.assertEqual(self.create_chat("Another question").status_code, 401)
        self.assertEqual(self.client.get(f"/api/v1/chat/{created['chat_id']}").status_code, 401)
        self.assertEqual(self.client.get(f"/api/v1/chat/{created['chat_id']}/stream").status_code, 401)
        self.assertEqual(self.client.get("/api/v1/sources/external:searxng:test").status_code, 401)

    def test_other_user_cannot_access_conversation(self):
        created = self.create_chat("Private question", course_id="CS537").json()
        self.authenticate(2)

        continued = self.create_chat(
            "Read another student's conversation",
            course_id="CS537",
            conversation_id=created["conversation_id"],
        )
        retrieved = self.client.get(f"/api/v1/chat/{created['chat_id']}")
        streamed = self.client.get(f"/api/v1/chat/{created['chat_id']}/stream")
        source = self.client.get("/api/v1/sources/external:searxng:test")

        self.assertEqual(continued.status_code, 404)
        self.assertEqual(retrieved.status_code, 404)
        self.assertEqual(streamed.status_code, 404)
        self.assertEqual(source.status_code, 404)
        self.assertEqual(len(self.fake_assistant_service.calls), 1)
        self.assertEqual(self.fake_assistant_service.history_calls, [[]])

    def test_source_lookup_with_shared_evidence_id_is_user_scoped(self):
        self.create_chat("First student's course question", course_id="CS537")
        self.authenticate(2)
        self.create_chat("Second student's course question", course_id="CS537")

        self.authenticate(1)
        first_source = self.client.get("/api/v1/sources/external:searxng:test")
        self.authenticate(2)
        second_source = self.client.get("/api/v1/sources/external:searxng:test")

        self.assertEqual(first_source.status_code, 200)
        self.assertEqual(second_source.status_code, 200)
        self.assertEqual(first_source.json()["url"], "https://example.com/source/1")
        self.assertEqual(second_source.json()["url"], "https://example.com/source/2")

    def test_course_context_cannot_change_within_conversation(self):
        created = self.create_chat("Explain a process", course_id="CS537").json()

        changed = self.create_chat(
            "Explain a different subject",
            course_id="CS557",
            conversation_id=created["conversation_id"],
        )
        removed = self.create_chat(
            "Explain the same subject",
            conversation_id=created["conversation_id"],
        )

        self.assertEqual(changed.status_code, 409)
        self.assertEqual(removed.status_code, 409)
        self.assertEqual(len(self.fake_assistant_service.calls), 1)

    def test_unknown_conversation_returns_404(self):
        response = self.create_chat(
            "Continue an unknown conversation",
            conversation_id=uuid4().hex,
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.fake_assistant_service.calls, [])

    def test_invalid_conversation_id_returns_422(self):
        response = self.create_chat(
            "Continue a conversation",
            conversation_id="not-a-valid-id",
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.fake_assistant_service.calls, [])

    def test_unassociated_legacy_chat_is_not_publicly_accessible(self):
        with self.session_factory() as db:
            legacy = ChatThreadRecord(
                chat_id=uuid4().hex,
                course_id=None,
                question="Legacy question",
                answer="Legacy answer",
            )
            db.add(legacy)
            db.flush()
            db.add(ChatEvidenceAssessmentRecord(
                chat_id=legacy.chat_id,
                mode="general",
                evidence_status="not_applicable",
                citations=[ExternalCitation(
                    evidence_id="external:legacy:private",
                    claim_ids=[],
                    provider="searxng",
                    title="Legacy source",
                    url="https://example.com/private",
                ).model_dump(mode="json")],
                claims=[],
            ))
            db.commit()
            legacy_id = legacy.chat_id

        response = self.client.get(f"/api/v1/chat/{legacy_id}")
        source = self.client.get("/api/v1/sources/external:legacy:private")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(source.status_code, 404)

    def test_owner_can_stream_chat(self):
        created = self.create_chat("A short question").json()
        response = self.client.get(f"/api/v1/chat/{created['chat_id']}/stream")

        self.assertEqual(response.status_code, 200)
        self.assertIn("event: token", response.text)
        self.assertIn("event: done", response.text)

    def test_continuation_receives_only_eight_recent_turns(self):
        first = self.create_chat("Question 0").json()
        conversation_id = first["conversation_id"]

        for index in range(1, 10):
            response = self.create_chat(
                f"Question {index}",
                conversation_id=conversation_id,
            )
            self.assertEqual(response.status_code, 201)

        final = self.create_chat("Summarize the discussion.", conversation_id=conversation_id)
        self.assertEqual(final.status_code, 201)

        history = self.fake_assistant_service.history_calls[-1]
        self.assertEqual(len(history), 8)
        self.assertEqual(history[0].question, "Question 2")
        self.assertEqual(history[-1].question, "Question 9")

    def test_failed_continuation_does_not_enter_history(self):
        first = self.create_chat("My favorite food is pizza.").json()
        conversation_id = first["conversation_id"]

        self.fake_assistant_service.fail = True
        failed = self.create_chat("This request fails.", conversation_id=conversation_id)
        self.assertEqual(failed.status_code, 503)

        self.fake_assistant_service.fail = False
        recovered = self.create_chat(
            "What is my favorite food?",
            conversation_id=conversation_id,
        )
        self.assertEqual(recovered.status_code, 201)

        history = self.fake_assistant_service.history_calls[-1]
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].question, "My favorite food is pizza.")

        with self.session_factory() as db:
            turn_count = db.scalar(
                select(func.count())
                .select_from(ChatConversationTurnRecord)
                .where(ChatConversationTurnRecord.conversation_id == conversation_id)
            )
        self.assertEqual(turn_count, 2)

    def test_course_continuation_receives_previous_turns(self):
        first = self.create_chat("What is a process?", course_id="CS537").json()
        response = self.create_chat(
            "How does it relate to scheduling?",
            course_id="CS537",
            conversation_id=first["conversation_id"],
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.fake_assistant_service.calls[-1], (
            "How does it relate to scheduling?", "CS537",
        ))
        self.assertEqual(self.fake_assistant_service.history_calls[-1], [
            ConversationTurn(
                question="What is a process?",
                answer="Generated answer: What is a process?",
            )
        ])


if __name__ == "__main__":
    unittest.main()