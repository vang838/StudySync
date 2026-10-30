import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.v1.chat import create_chat, get_chat
from src.api.v1.sources import get_source
from src.application.assistant_service import AssistantResult
from src.db.base import Base
from src.db.chat_evidence_models import ChatEvidenceAssessmentRecord
from src.db.models import ChatThreadRecord
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

    def generate(self, *, question: str, course_id: str | None = None) -> AssistantResult:
        if self.fail:
            raise LLMUnavailableError("Test connection failure")

        self.calls.append((question, course_id))

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
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.fake_assistant_service = FakeAssistantService()

    def tearDown(self):
        self.engine.dispose()

    def test_chat_generation_and_evidence_persistence(self):
        with self.session_factory() as db:
            response = create_chat(
                ChatCreateRequest(
                    course_id="CS537",
                    question="What is a process?",
                ),
                db,
                self.fake_assistant_service,
            )

            self.assertEqual(
                self.fake_assistant_service.calls,
                [("What is a process?", "CS537")],
            )
            self.assertEqual(response.mode, "course")
            self.assertEqual(response.evidence_status, "sufficient")
            self.assertEqual(response.citations[0].evidence_id, "external:searxng:test")
            self.assertEqual(response.citations[0].claim_ids, ["claim-1"])
            self.assertEqual(response.claims[0].claim_id, "claim-1")

            saved = get_chat(response.chat_id, db)

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
                    ChatCreateRequest(
                        course_id="CS537",
                        question="What is a process?",
                    ),
                    db,
                    self.fake_assistant_service,
                )

            self.assertEqual(caught.exception.status_code, 503)
            count = db.scalar(select(func.count()).select_from(ChatThreadRecord))
            self.assertEqual(count, 0)

    def test_general_chat_without_course(self):
        with self.session_factory() as db:
            response = create_chat(
                ChatCreateRequest(question="Who developed the theory of relativity?"),
                db,
                self.fake_assistant_service,
            )

            self.assertEqual(response.mode, "general")
            self.assertEqual(response.evidence_status, "not_applicable")
            self.assertEqual(response.citations, [])
            self.assertEqual(response.claims, [])


if __name__ == "__main__":
    unittest.main()
