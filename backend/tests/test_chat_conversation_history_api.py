import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.dependencies import get_assistant_service
from src.api.v1.chat import router as chat_router
from src.application.assistant_service import AssistantResult
from src.core.security import create_session_token
from src.db.base import Base
from src.db.models import User
from src.db.session import get_db
from src.schemas.retrieval import ExternalCitation


class FakeAssistantService:
    def __init__(self):
        self.calls = 0

    def generate(self, *, question, course_id=None, hint_level=None, history=None):
        self.calls += 1
        if course_id:
            return AssistantResult(
                answer=f"Course answer {self.calls}",
                mode="course",
                citations=[ExternalCitation(
                    evidence_id=f"external:test:{self.calls}",
                    claim_ids=[],
                    provider="searxng",
                    title=f"Source {self.calls}",
                    url=f"https://example.com/{self.calls}",
                )],
                evidence_status="sufficient",
            )
        return AssistantResult(answer=f"General answer {self.calls}", mode="general", citations=[])


class TestChatConversationHistoryAPI(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.assistant = FakeAssistantService()

        with self.session_factory() as db:
            db.add_all([
                User(user_id=1, user_first_name="First", user_last_name="Student",
                     user_email="first@example.com", password_hash="test-hash"),
                User(user_id=2, user_first_name="Second", user_last_name="Student",
                     user_email="second@example.com", password_hash="test-hash"),
            ])
            db.commit()

        app = FastAPI()
        app.include_router(chat_router, prefix="/api/v1")
        app.dependency_overrides[get_db] = self.get_test_db
        app.dependency_overrides[get_assistant_service] = lambda: self.assistant
        self.client = TestClient(app)
        self.authenticate(1)

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def get_test_db(self):
        with self.session_factory() as db:
            yield db

    def authenticate(self, user_id):
        self.client.cookies.set("studysync_session", create_session_token(user_id))

    def create_chat(self, question, course_id=None, conversation_id=None):
        payload = {"question": question}
        if course_id is not None: payload["course_id"] = course_id
        if conversation_id is not None: payload["conversation_id"] = conversation_id
        response = self.client.post("/api/v1/chat", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_empty_history(self):
        response = self.client.get("/api/v1/chat/conversations")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"items": [], "has_more": False})

    def test_list_shows_first_question_and_latest_activity(self):
        first = self.create_chat("First question")
        second = self.create_chat("Second question")
        self.create_chat("Follow-up", conversation_id=first["conversation_id"])

        response = self.client.get("/api/v1/chat/conversations")
        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]
        self.assertEqual([item["conversation_id"] for item in items], [first["conversation_id"], second["conversation_id"]])
        self.assertEqual([item["title"] for item in items], ["First question", "Second question"])
        self.assertEqual(self.assistant.calls, 3)

    def test_list_pagination(self):
        for index in range(3): self.create_chat(f"Question {index}")

        first_page = self.client.get("/api/v1/chat/conversations?limit=2&offset=0")
        last_page = self.client.get("/api/v1/chat/conversations?limit=2&offset=2")
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(last_page.status_code, 200)
        self.assertEqual(len(first_page.json()["items"]), 2)
        self.assertTrue(first_page.json()["has_more"])
        self.assertEqual(len(last_page.json()["items"]), 1)
        self.assertFalse(last_page.json()["has_more"])

    def test_list_rejects_invalid_pagination(self):
        for query in ("limit=0", "limit=51", "offset=-1"):
            with self.subTest(query=query):
                response = self.client.get(f"/api/v1/chat/conversations?{query}")
                self.assertEqual(response.status_code, 422)

    def test_detail_restores_turns_and_individual_citations(self):
        first = self.create_chat("What is a process?", course_id="CS537")
        self.create_chat("How is it scheduled?", course_id="CS537", conversation_id=first["conversation_id"])

        response = self.client.get(f"/api/v1/chat/conversations/{first['conversation_id']}")
        self.assertEqual(response.status_code, 200)
        detail = response.json()
        self.assertEqual(detail["course_id"], "CS537")
        self.assertEqual([turn["question"] for turn in detail["turns"]], ["What is a process?", "How is it scheduled?"])
        self.assertEqual([turn["citations"][0]["evidence_id"] for turn in detail["turns"]], ["external:test:1", "external:test:2"])
        self.assertEqual([[message["role"] for message in turn["messages"]] for turn in detail["turns"]], [
            ["user", "assistant"], ["user", "assistant"],
        ])
        self.assertEqual(self.assistant.calls, 2)

    def test_isolation_of_list_and_detail(self):
        private = self.create_chat("Student 1 private question")
        self.authenticate(2)
        own = self.create_chat("Student 2 question")

        listing = self.client.get("/api/v1/chat/conversations")
        other_detail = self.client.get(f"/api/v1/chat/conversations/{private['conversation_id']}")
        own_detail = self.client.get(f"/api/v1/chat/conversations/{own['conversation_id']}")
        self.assertEqual([item["conversation_id"] for item in listing.json()["items"]], [own["conversation_id"]])
        self.assertEqual(other_detail.status_code, 404)
        self.assertEqual(own_detail.status_code, 200)

    def test_unauthenticated_requests_are_denied(self):
        private = self.create_chat("Private question")
        self.client.cookies.clear()
        self.assertEqual(self.client.get("/api/v1/chat/conversations").status_code, 401)
        self.assertEqual(self.client.get(f"/api/v1/chat/conversations/{private['conversation_id']}").status_code, 401)

    def test_unknown_conversation_returns_404(self):
        response = self.client.get("/api/v1/chat/conversations/00000000000000000000000000000000")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
