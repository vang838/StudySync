from unittest import TestCase
from unittest.mock import Mock

from src.application.assistant_service import AssistantService
from src.application.rag_service import RAGResult, RAGService
from src.ports.llm import LLMPort


class TestAssistantDocumentRouting(TestCase):
    def setUp(self):
        self.llm = Mock(spec=LLMPort)
        self.rag = Mock(spec=RAGService)
        self.service = AssistantService(llm=self.llm, rag_service=self.rag)

    def test_document_references_bypass_model_classification(self):
        questions = [
            "The hello_595.pdf talks about what?",
            "What does the hello_595 pdf contain?",
            "What does the Hello_595 PDF contain?",
            "Summarize assignment docx.",
            'Summarize "Hello_595.PDF".',
            "Explain the assignment.docx requirements.",
            "What does lecture.pptx cover?",
            "Summarize notes.txt.",
            "What do my uploaded documents cover?",
            "Summarize the attached file.",
            "What does the file I uploaded cover?",
            "What is in the document I attached?",
            "Summarize my PDF.",
        ]
        self.llm.generate.return_value = "GENERAL"
        self.rag.generate.return_value = RAGResult(answer="Document-grounded answer.", citations=[])

        for question in questions:
            with self.subTest(question=question):
                self.rag.reset_mock()

                result = self.service.generate(question=question, course_id="COMPSCI 595")

                self.assertEqual(result.mode, "course")
                self.assertEqual(result.answer, "Document-grounded answer.")
                self.rag.generate.assert_called_once_with(question=question, course_id="COMPSCI 595")
                self.llm.generate.assert_not_called()

    def test_document_question_without_course_preserves_general_mode(self):
        self.llm.generate.return_value = "General answer."

        result = self.service.generate(question="The hello_595.pdf talks about what?")

        self.assertEqual(result.mode, "general")
        self.rag.generate.assert_not_called()

    def test_general_pdf_question_still_uses_classifier(self):
        for question in [
            "What is a PDF file?", "What is the PDF format?", "How do I convert to PDF?",
            "How do I create an accessible PDF?", "What is an accessible PDF?",
        ]:
            with self.subTest(question=question):
                self.llm.reset_mock()
                self.llm.generate.side_effect = ["GENERAL", "PDF is a document format."]

                result = self.service.generate(question=question, course_id="COMPSCI 595")

                self.assertEqual(result.mode, "general")
                self.assertEqual(result.answer, "PDF is a document format.")
                self.assertEqual(self.llm.generate.call_count, 2)
                self.rag.generate.assert_not_called()
