from unittest import TestCase
from unittest.mock import Mock

from src.application.assistant_service import AssistantService
from src.application.rag_service import RAGResult, RAGService
from src.ports.conversation_history import ConversationTurn
from src.ports.course_repository import CourseRepositoryPort
from src.ports.llm import LLMPort


class TestAssistantConversationContext(TestCase):
    def setUp(self):
        self.llm = Mock(spec=LLMPort)
        self.rag_service = Mock(spec=RAGService)
        self.course_repository = Mock(spec=CourseRepositoryPort)
        self.course_repository.get_by_id.return_value = None

        self.service = AssistantService(
            llm=self.llm,
            rag_service=self.rag_service,
            course_repository=self.course_repository,
        )

    def test_general_response_receives_previous_turns(self):
        self.llm.generate.return_value = "Your favorite food is pizza."
        history = [
            ConversationTurn(
                question="Pizza is my favorite food.",
                answer="Understood.",
            )
        ]

        result = self.service.generate(
            question="What is my favorite food?",
            history=history,
        )

        prompt = self.llm.generate.call_args.args[0]
        self.assertEqual(result.answer, "Your favorite food is pizza.")
        self.assertEqual(result.mode, "general")
        self.assertIn('"user": "Pizza is my favorite food."', prompt)
        self.assertIn('"assistant": "Understood."', prompt)
        self.assertIn("Current student message:\nWhat is my favorite food?", prompt)
        self.rag_service.generate.assert_not_called()

    def test_empty_history_preserves_existing_generation(self):
        self.llm.generate.return_value = "General answer."

        self.service.generate(
            question="What is a computer?",
            history=[],
        )

        self.llm.generate.assert_called_once_with("What is a computer?")

    def test_history_is_limited_to_eight_recent_turns(self):
        self.llm.generate.return_value = "Summary."
        history = [
            ConversationTurn(
                question=f"History question {index}",
                answer=f"History answer {index}",
            )
            for index in range(10)
        ]

        self.service.generate(question="Summarize our discussion.", history=history)

        prompt = self.llm.generate.call_args.args[0]
        self.assertNotIn("History question 0", prompt)
        self.assertNotIn("History question 1", prompt)
        self.assertIn("History question 2", prompt)
        self.assertIn("History question 9", prompt)

    def test_long_history_is_bounded(self):
        self.llm.generate.return_value = "Summary."
        history = [
            ConversationTurn(
                question="A" * 5000,
                answer="B" * 5000,
            )
            for _ in range(8)
        ]

        self.service.generate(question="Summarize.", history=history)

        prompt = self.llm.generate.call_args.args[0]
        self.assertLess(len(prompt), 11000)
        self.assertNotIn("A" * 1601, prompt)
        self.assertNotIn("B" * 1601, prompt)

    def test_hint_guidance_is_preserved_with_history(self):
        self.llm.generate.return_value = "A conceptual hint."
        history = [
            ConversationTurn(
                question="I am working on a difficult problem.",
                answer="Which part is confusing?",
            )
        ]

        self.service.generate(
            question="Help me understand the next step.",
            hint_level=1,
            history=history,
        )

        prompt = self.llm.generate.call_args.args[0]
        self.assertIn("Give only a brief conceptual hint.", prompt)
        self.assertIn("I am working on a difficult problem.", prompt)
        self.assertIn("Help me understand the next step.", prompt)

    def test_general_question_with_selected_course_receives_history(self):
        self.llm.generate.side_effect = [
            "GENERAL",
            "Your favorite food is pizza.",
        ]
        history = [
            ConversationTurn(
                question="Pizza is my favorite food.",
                answer="Understood.",
            )
        ]

        result = self.service.generate(
            question="What is my favorite food?",
            course_id="CS537",
            history=history,
        )

        self.assertEqual(result.mode, "general")
        self.assertEqual(self.llm.generate.call_count, 2)
        prompt = self.llm.generate.call_args_list[1].args[0]
        self.assertIn("Pizza is my favorite food.", prompt)
        self.rag_service.generate.assert_not_called()

    def test_course_retrieval_remains_grounded_in_current_question(self):
        self.llm.generate.return_value = "COURSE"
        self.rag_service.generate.return_value = RAGResult(
            answer="Course-grounded answer.",
            citations=[],
        )
        history = [
            ConversationTurn(
                question="Tell me about my favorite food.",
                answer="Pizza is your favorite food.",
            )
        ]

        result = self.service.generate(
            question="Explain how operating systems schedule processes.",
            course_id="CS537",
            history=history,
        )

        self.assertEqual(result.mode, "course")
        self.assertEqual(result.answer, "Course-grounded answer.")
        self.rag_service.generate.assert_called_once_with(
            question="Explain how operating systems schedule processes.",
            course_id="CS537",
            hint_level=None,
            source_policy="internal_only",
            retrieval_query="Explain how operating systems schedule processes.",
        )
