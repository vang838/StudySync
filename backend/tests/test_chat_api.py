import unittest

from fastapi.testclient import TestClient

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.api.dependencies import get_assistant_service
from src.application.assistant_service import AssistantResult
from src.db.base import Base
from src.db.models import ChatThreadRecord
from src.db.session import get_db
from src.ports.llm import LLMUnavailableError


class FakeAssistantService:
    def __init__(self):
        self.fail = False
        self.calls = []

    def generate(self, *, question: str, course_id: str | None = None) -> AssistantResult:
        if self.fail:
            raise LLMUnavailableError("Test connection failure")

        self.calls.append((question, course_id))
        return AssistantResult(
            answer=f"Generated answer: {question}",
            mode="course" if course_id else "general",
        )


class TestChatAPI(unittest.TestCase):

    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        Base.metadata.create_all(self.engine)

        self.session_factory = sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )

        self.fake_assistant_service = FakeAssistantService()

        def override_db():
            with self.session_factory() as db:
                yield db

        def override_assistant_service():
            return self.fake_assistant_service
        
        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_assistant_service] = override_assistant_service
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_chat_generation_and_persistence(self):
        response = self.client.post(
            "/api/v1/chat",
            json={
                "course_id": "CS537",
                "question": "What is a process?",
            },
        )

        self.assertEqual(response.status_code, 201)
        
        self.assertEqual(
            self.fake_assistant_service.calls,
            [("What is a process?", "CS537")],
        )
        
        data = response.json()
        self.assertEqual(
            data["answer"],
            "Generated answer: What is a process?",
        )
        
        self.assertEqual(data["mode"], "course")

        chat_id = data["chat_id"]

        # Confirm persisted response.
        saved = self.client.get(
            f"/api/v1/chat/{chat_id}"
        )

        self.assertEqual(saved.status_code, 200)

        self.assertEqual(
            saved.json()["answer"],
            data["answer"],
        )

        self.assertEqual(
            len(saved.json()["messages"]),
            2,
        )

    def test_unavailable_llm_does_not_create_chat(self):
        self.fake_assistant_service.fail = True

        response = self.client.post(
            "/api/v1/chat",
            json={
                "course_id": "CS537",
                "question": "What is a process?",
            },
        )

        self.assertEqual(response.status_code, 503)

        with self.session_factory() as db:
            count = db.scalar(
                select(func.count()).select_from(
                    ChatThreadRecord
                )
            )

            self.assertEqual(count, 0)
    
    def test_general_chat_without_course(self):
        response = self.client.post(
            "/api/v1/chat",
            json={
                "question": "Who developed the theory of relativity?",
            },
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            self.fake_assistant_service.calls,
            [("Who developed the theory of relativity?", None)],
        )

        data = response.json()
        self.assertIsNone(data["course_id"])
        self.assertEqual(
            data["answer"],
            "Generated answer: Who developed the theory of relativity?",
        )
        
        self.assertEqual(data["mode"], "general")

        with self.session_factory() as db:
            thread = db.get(ChatThreadRecord, data["chat_id"])
            self.assertIsNotNone(thread)
            self.assertIsNone(thread.course_id)


if __name__ == "__main__":
    unittest.main()