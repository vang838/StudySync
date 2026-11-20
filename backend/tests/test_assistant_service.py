
from unittest import TestCase
from unittest.mock import Mock

from src.application.assistant_service import AssistantService
from src.application.rag_service import RAGResult, RAGService
from src.ports.course_repository import CourseMetadata, CourseRepositoryPort
from src.ports.llm import LLMPort
from src.schemas.retrieval import ExternalCitation


class TestAssistantService(TestCase):
    def setUp(self) -> None:
        self.llm = Mock(spec=LLMPort)
        self.rag_service = Mock(spec=RAGService)
        self.course_repository = Mock(spec=CourseRepositoryPort)
        self.course_repository.get_by_id.return_value = None

        self.service = AssistantService(
            llm=self.llm,
            rag_service=self.rag_service,
            course_repository=self.course_repository,
        )

        self.course = CourseMetadata(
            course_id="FILM 220",
            title="16mm Filmmaking",
            description="3 cr. Post-foundation studio in 16mm film production.",
            subject="FILM",
            professor="S. Drake",
            year=2026,
        )

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
            hint_level=None,
            source_policy="internal_only",
            retrieval_query="How do I solve problem 7?",
        )

    def test_passes_hint_level_to_rag(self) -> None:
        self.llm.generate.return_value = "COURSE"
        self.rag_service.generate.return_value = RAGResult(
            answer="Conceptual hint.",
            citations=[],
        )

        result = self.service.generate(
            question="How do I solve problem 7?",
            course_id="MATH101",
            hint_level=1,
        )

        self.assertEqual(result.answer, "Conceptual hint.")
        self.assertEqual(result.mode, "course")
        self.rag_service.generate.assert_called_once_with(
            question="How do I solve problem 7?",
            course_id="MATH101",
            hint_level=1,
            source_policy="internal_only",
            retrieval_query="How do I solve problem 7?",
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

    def test_resolves_course_context_before_rag(self) -> None:
        self.course_repository.get_by_id.return_value = self.course
        self.llm.generate.return_value = "COURSE"
        self.rag_service.generate.return_value = RAGResult(
            answer="Course-grounded answer.",
            citations=[],
        )

        result = self.service.generate(
            question="Explain the material from Lecture 3.",
            course_id=" FILM 220 ",
        )

        self.assertEqual(result.mode, "course")
        self.course_repository.get_by_id.assert_called_once_with("FILM 220")
        self.rag_service.generate.assert_called_once_with(
            question="Explain the material from Lecture 3.",
            course_id="FILM 220",
            hint_level=None,
            source_policy="internal_only",
            retrieval_query="16mm Filmmaking: Explain the material from Lecture 3.",
        )

    def test_course_description_uses_metadata_without_rag(self) -> None:
        self.course_repository.get_by_id.return_value = self.course

        result = self.service.generate(
            question="What is this class about?",
            course_id="FILM 220",
            hint_level=1,
        )

        self.assertIn("16mm Filmmaking", result.answer)
        self.assertIn(self.course.description, result.answer)
        self.assertIn("StudySync course catalog", result.answer)
        self.assertEqual(result.mode, "course")
        self.assertEqual(result.evidence_status, "not_applicable")
        self.assertEqual(result.citations, [])
        self.assertEqual(result.claims, [])
        self.llm.generate.assert_not_called()
        self.rag_service.generate.assert_not_called()

    def test_known_metadata_questions_use_catalog(self) -> None:
        self.course_repository.get_by_id.return_value = self.course

        questions = {
            "Who teaches this course?": "S. Drake",
            "What is the course title?": "16mm Filmmaking",
            "What subject is this course?": "FILM",
            "What year is this course?": "2026",
        }

        for question, expected in questions.items():
            with self.subTest(question=question):
                result = self.service.generate(question=question, course_id="FILM 220")
                self.assertIn(expected, result.answer)
                self.assertEqual(result.mode, "course")

        self.llm.generate.assert_not_called()
        self.rag_service.generate.assert_not_called()

    def test_classifier_uses_course_metadata_for_other_phrasings(self) -> None:
        self.course_repository.get_by_id.return_value = self.course
        self.llm.generate.return_value = "DESCRIPTION"

        result = self.service.generate(
            question="Could you summarize what FILM 220 covers?",
            course_id="FILM 220",
        )

        self.assertIn(self.course.description, result.answer)
        classifier_prompt = self.llm.generate.call_args.args[0]
        self.assertIn("FILM 220", classifier_prompt)
        self.assertIn("16mm Filmmaking", classifier_prompt)
        self.rag_service.generate.assert_not_called()

    def test_missing_instructor_does_not_invent_one(self) -> None:
        self.course_repository.get_by_id.return_value = CourseMetadata(
            course_id="FILM 220",
            title="16mm Filmmaking",
            description=None,
            subject="FILM",
            professor=None,
            year=2026,
        )

        result = self.service.generate(
            question="Who teaches this course?",
            course_id="FILM 220",
        )

        self.assertIn("No instructor is listed", result.answer)
        self.llm.generate.assert_not_called()
        self.rag_service.generate.assert_not_called()

    def test_missing_course_metadata_is_reported(self) -> None:
        result = self.service.generate(
            question="What is this class about?",
            course_id="UNKNOWN 999",
        )

        self.assertIn("couldn't find course details", result.answer)
        self.llm.generate.assert_not_called()
        self.rag_service.generate.assert_not_called()

    def test_general_question_remains_general_with_course_selected(self) -> None:
        self.course_repository.get_by_id.return_value = self.course
        self.llm.generate.side_effect = ["GENERAL", "Albert Einstein."]

        result = self.service.generate(
            question="Who developed the theory of relativity?",
            course_id="FILM 220",
        )

        self.assertEqual(result.mode, "general")
        self.assertEqual(result.answer, "Albert Einstein.")
        self.rag_service.generate.assert_not_called()

    def test_explicit_web_request_uses_external_only(self) -> None:
        self.course_repository.get_by_id.return_value = self.course
        self.rag_service.generate.return_value = RAGResult(
            answer="External reference answer.",
            citations=[],
        )

        result = self.service.generate(
            question="Search the web for 16mm filmmaking resources.",
            course_id="FILM 220",
        )

        self.assertEqual(result.mode, "course")
        self.assertEqual(result.answer, "External reference answer.")
        self.rag_service.generate.assert_called_once_with(
            question="Search the web for 16mm filmmaking resources.",
            course_id="FILM 220",
            hint_level=None,
            source_policy="external_only",
            retrieval_query="Search the web for 16mm filmmaking resources.",
        )
        self.llm.generate.assert_not_called()

    def test_explicit_topic_preserves_retrieval_query(self) -> None:
        self.course_repository.get_by_id.return_value = self.course
        self.llm.generate.return_value = "COURSE"
        self.rag_service.generate.return_value = RAGResult(
            answer="Course-grounded answer.",
            citations=[],
        )

        result = self.service.generate(
            question="Explain aperture and exposure.",
            course_id="FILM 220",
        )

        self.assertEqual(result.mode, "course")
        self.rag_service.generate.assert_called_once_with(
            question="Explain aperture and exposure.",
            course_id="FILM 220",
            hint_level=None,
            source_policy="internal_only",
            retrieval_query="Explain aperture and exposure.",
        )
