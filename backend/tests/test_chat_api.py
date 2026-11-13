
import asyncio
import unittest
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.dependencies import get_assistant_service, get_current_user
from src.api.v1.chat import create_chat, get_chat, router as chat_router, stream_chat
from src.api.v1.sources import get_source
from src.application.assistant_service import AssistantResult
from src.db.base import Base
from src.db.chat_evidence_models import ChatEvidenceAssessmentRecord
from src.db.models import ChatThreadRecord, User
from src.db.session import get_db
from src.ports.llm import LLMUnavailableError
from src.schemas.contracts import ChatCreateRequest
from src.schemas.retrieval import (
    ClaimEvidenceAssociation,
    ExternalCitation,
    GeneratedClaim,
)


class FakeAssistantService:
    def __init__(self):
        self.fail = False
        self.calls = []
        self.last_request = None

    def generate(
        self, *, question: str, course_id: str | None = None, hint_level: int | None = None,
        user_id: int | None = None, document_ids: list[str] | None = None,
        source_scope: str = "both",
    ) -> AssistantResult:
        if self.fail:
            raise LLMUnavailableError("Test connection failure")

        self.calls.append((question, course_id))
        self.last_request = (user_id, document_ids, source_scope)

        if course_id:
            citation = ExternalCitation(
                evidence_id="external:searxng:test",
                claim_ids=["claim-1"],
                provider="searxng",
                title="Test Source",
                url="https://example.com/source",
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

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.fake_assistant_service = FakeAssistantService()

        with self.session_factory() as db:
            self.current_user = User(
                user_first_name="Alice",
                user_last_name="Student",
                user_email="alice@example.com",
                password_hash="test-only-hash",
            )
            self.other_user = User(
                user_first_name="Bob",
                user_last_name="Student",
                user_email="bob@example.com",
                password_hash="test-only-hash",
            )
            db.add_all([self.current_user, self.other_user])
            db.commit()

        self.app = FastAPI()
        self.app.include_router(chat_router, prefix="/api/v1")

        def override_db():
            with self.session_factory() as db:
                yield db

        self.app.dependency_overrides[get_db] = override_db
        self.app.dependency_overrides[get_assistant_service] = lambda: self.fake_assistant_service
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        self.app.dependency_overrides.clear()
        self.engine.dispose()

    def authenticate(self, user: User):
        self.app.dependency_overrides[get_current_user] = lambda: user

    def test_chat_generation_and_evidence_persistence(self):
        with self.session_factory() as db:
            response = create_chat(
                ChatCreateRequest(course_id="CS537", question="What is a process?"),
                db, self.fake_assistant_service, self.current_user,
            )

            self.assertEqual(
                self.fake_assistant_service.calls,
                [("What is a process?", "CS537")],
            )
            self.assertEqual(self.fake_assistant_service.last_request, (self.current_user.user_id, None, "both"))
            self.assertEqual(db.get(ChatThreadRecord, response.chat_id).user_id, self.current_user.user_id)

            self.assertEqual(response.mode, "course")
            self.assertEqual(response.evidence_status, "sufficient")
            self.assertEqual(response.citations[0].evidence_id, "external:searxng:test")
            self.assertEqual(response.citations[0].claim_ids, ["claim-1"])
            self.assertEqual(response.claims[0].claim_id, "claim-1")

            saved = get_chat(response.chat_id, db, self.current_user)

            self.assertEqual(saved.answer, response.answer)
            self.assertEqual(saved.citations, response.citations)
            self.assertEqual(saved.claims, response.claims)
            self.assertEqual(len(saved.messages), 2)

            source = get_source("external:searxng:test", db)
            self.assertEqual(source.evidence_id, "external:searxng:test")

            assessment = db.scalar(
                select(ChatEvidenceAssessmentRecord).where(
                    ChatEvidenceAssessmentRecord.chat_id == response.chat_id
                )
            )
            self.assertIsNotNone(assessment)

    def test_unavailable_llm_does_not_create_chat(self):
        self.fake_assistant_service.fail = True

        with self.session_factory() as db:
            with self.assertRaises(HTTPException) as caught:
                create_chat(
                    ChatCreateRequest(course_id="CS537", question="What is a process?"),
                    db, self.fake_assistant_service, self.current_user,
                )

            self.assertEqual(caught.exception.status_code, 503)
            count = db.scalar(select(func.count()).select_from(ChatThreadRecord))
            self.assertEqual(count, 0)

    def test_general_chat_without_course(self):
        with self.session_factory() as db:
            response = create_chat(
                ChatCreateRequest(question="Who developed the theory of relativity?"),
                db, self.fake_assistant_service, self.current_user,
            )

            self.assertEqual(response.mode, "general")
            self.assertEqual(response.evidence_status, "not_applicable")
            self.assertEqual(response.citations, [])
            self.assertEqual(response.claims, [])
            self.assertIsNone(response.course_id)
            self.assertEqual(self.fake_assistant_service.last_request, (self.current_user.user_id, None, "both"))
            self.assertEqual(db.get(ChatThreadRecord, response.chat_id).user_id, self.current_user.user_id)

    def test_other_user_cannot_read_chat(self):
        with self.session_factory() as db:
            response = create_chat(
                ChatCreateRequest(question="Private conversation"),
                db, self.fake_assistant_service, self.current_user,
            )

            with self.assertRaises(HTTPException) as caught:
                get_chat(response.chat_id, db, self.other_user)

            self.assertEqual(caught.exception.status_code, 404)

    def test_other_user_cannot_stream_chat(self):
        with self.session_factory() as db:
            response = create_chat(
                ChatCreateRequest(question="Private conversation"),
                db, self.fake_assistant_service, self.current_user,
            )

            with self.assertRaises(HTTPException) as caught:
                asyncio.run(stream_chat(response.chat_id, db, self.other_user))

            self.assertEqual(caught.exception.status_code, 404)

    def test_sqlite_enforces_foreign_keys(self):
        with self.engine.connect() as conn:
            enabled = conn.exec_driver_sql("PRAGMA foreign_keys").scalar()

        self.assertEqual(enabled, 1)

    def test_http_unauthenticated_requests_are_rejected(self):
        requests = [
            ("POST", "/api/v1/chat", {"json": {"question": "Private question"}}),
            ("GET", "/api/v1/chat/missing-chat", {}),
            ("GET", "/api/v1/chat/missing-chat/stream", {}),
        ]

        for method, path, kwargs in requests:
            with self.subTest(method=method, path=path):
                response = self.client.request(method, path, **kwargs)
                self.assertEqual(response.status_code, 401)

        self.assertEqual(self.fake_assistant_service.calls, [])

    def test_http_owner_can_read_and_stream_chat(self):
        self.authenticate(self.current_user)

        created = self.client.post(
            "/api/v1/chat",
            json={"question": "Explain mutex locks."},
        )
        self.assertEqual(created.status_code, 201)

        chat_id = created.json()["chat_id"]

        retrieved = self.client.get(f"/api/v1/chat/{chat_id}")
        self.assertEqual(retrieved.status_code, 200)
        self.assertEqual(retrieved.json()["chat_id"], chat_id)
        self.assertEqual(retrieved.json()["answer"], "Generated answer: Explain mutex locks.")

        streamed = self.client.get(f"/api/v1/chat/{chat_id}/stream")
        self.assertEqual(streamed.status_code, 200)
        self.assertIn("text/event-stream", streamed.headers["content-type"])
        self.assertIn("event: token", streamed.text)
        self.assertIn(f"event: done\ndata: {chat_id}", streamed.text)

    def test_http_other_user_cannot_read_or_stream_chat(self):
        self.authenticate(self.current_user)

        created = self.client.post(
            "/api/v1/chat",
            json={"question": "Private conversation"},
        )
        self.assertEqual(created.status_code, 201)

        chat_id = created.json()["chat_id"]

        self.authenticate(self.other_user)

        retrieved = self.client.get(f"/api/v1/chat/{chat_id}")
        streamed = self.client.get(f"/api/v1/chat/{chat_id}/stream")

        self.assertEqual(retrieved.status_code, 404)
        self.assertEqual(streamed.status_code, 404)

    def test_http_legacy_chat_is_inaccessible(self):
        now = datetime.now(timezone.utc)
        chat_id = uuid4().hex

        with self.session_factory() as db:
            db.add(ChatThreadRecord(
                chat_id=chat_id,
                user_id=None,
                course_id=None,
                question="Legacy private conversation",
                answer="Legacy private answer",
                created_at=now,
                updated_at=now,
            ))
            db.commit()

        self.authenticate(self.current_user)

        retrieved = self.client.get(f"/api/v1/chat/{chat_id}")
        streamed = self.client.get(f"/api/v1/chat/{chat_id}/stream")

        self.assertEqual(retrieved.status_code, 404)
        self.assertEqual(streamed.status_code, 404)

    def test_http_document_selection_is_forwarded(self):
        self.authenticate(self.current_user)

        response = self.client.post(
            "/api/v1/chat",
            json={
                "course_id": "CS537",
                "question": "Explain mutex locks.",
                "source_scope": "documents",
                "document_ids": ["doc-1"],
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["mode"], "course")
        self.assertEqual(
            self.fake_assistant_service.last_request,
            (self.current_user.user_id, ["doc-1"], "documents"),
        )


if __name__ == "__main__":
    unittest.main()
