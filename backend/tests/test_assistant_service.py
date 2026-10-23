from unittest import TestCase
from unittest.mock import Mock

from src.application.assistant_service import AssistantService
from src.application.rag_service import RAGResult, RAGService
from src.ports.llm import LLMPort
from src.schemas.retrieval import ExternalCitation


class TestAssistantService(TestCase):
    def setUp(self) -> None:
        self.llm = Mock(spec=LLMPort)
        self.rag_service = Mock(spec=RAGService)
        self.service = AssistantService(llm=self.llm, rag_service=self.rag_service)

    def test_uses_general_llm_without_course_context(self) -> None:
        self.llm.generate.return_value = "General answer."

        result = self.service.generate(question="Who developed the theory of relativity?")

        self.assertEqual(result.answer, "General answer.")
        self.assertEqual(result.mode, "general")
        self.assertEqual(result.citations, [])
        self.llm.generate.assert_called_once_with("Who developed the theory of relativity?")
        self.rag_service.generate.assert_not_called()

    def test_routes_course_question_to_rag(self) -> None:
        self.llm.generate.return_value = "COURSE"
        citation = ExternalCitation(
            provider="searxng",
            title="Course Reference",
            url="https://example.com/course",
        )
        self.rag_service.generate.return_value = RAGResult(
            answer="Course-grounded answer.",
            citations=[citation],
        )

        result = self.service.generate(
            question="How do I solve problem 7?",
            course_id="MATH101",
        )

        self.assertEqual(result.answer, "Course-grounded answer.")
        self.assertEqual(result.mode, "course")
        self.assertEqual(result.citations, [citation])
        self.rag_service.generate.assert_called_once_with(
            question="How do I solve problem 7?",
            course_id="MATH101",
        )

    def test_routes_general_question_away_from_rag(self) -> None:
        self.llm.generate.side_effect = ["GENERAL", "Pythagoras is traditionally credited."]

        result = self.service.generate(
            question="Who is credited with the Pythagorean theorem?",
            course_id="MATH101",
        )

        self.assertEqual(result.answer, "Pythagoras is traditionally credited.")
        self.assertEqual(result.mode, "general")
        self.assertEqual(result.citations, [])
        self.rag_service.generate.assert_not_called()

    def test_rejects_empty_question(self) -> None:
        with self.assertRaisesRegex(ValueError, "question must not be empty"):
            self.service.generate(question="   ")

        self.llm.generate.assert_not_called()
        self.rag_service.generate.assert_not_called()