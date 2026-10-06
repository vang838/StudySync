import unittest

from fastapi.testclient import TestClient

from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.api.dependencies import get_rag_service
from src.db.base import Base
from src.db.models import ChatThreadRecord
from src.db.session import get_db
from src.ports.llm import LLMUnavailableError


class FakeRAGService:
    def __init__(self):
        self.fail = False
        self.calls = []

    def generate(self, *, question: str, course_id: str, document_ids: list[str] | None = None, top_k: int = 5) -> str:
        if self.fail:
            raise LLMUnavailableError("Test connection failure")

        self.calls.append((question, course_id))
        return f"Generated answer: {question}"


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

        self.fake_rag_service = FakeRAGService()

        def override_db():
            with self.session_factory() as db:
                yield db

        def override_rag_service():
            return self.fake_rag_service

        app.dependency_overrides[get_rag_service] = override_rag_service

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
            self.fake_rag_service.calls,
            [("What is a process?", "CS537")],
        )
        
        data = response.json()
        self.assertEqual(
            data["answer"],
            "Generated answer: What is a process?",
        )

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
        self.fake_rag_service.fail = True

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


if __name__ == "__main__":
    unittest.main()