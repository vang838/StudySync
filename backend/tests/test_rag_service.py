from unittest import TestCase
from unittest.mock import Mock

from src.application.evidence_retrieval_service import EvidenceRetrievalService
from src.application.rag_service import RAGService
from src.ports.llm import LLMPort
from src.schemas.retrieval import Evidence


class TestRAGService(TestCase):
    def setUp(self) -> None:
        self.retrieval_service = Mock(spec=EvidenceRetrievalService)
        self.llm = Mock(spec=LLMPort)
        self.service = RAGService(retrieval_service=self.retrieval_service, llm=self.llm)

    def test_supplies_retrieved_context_to_llm(self) -> None:
        self.retrieval_service.retrieve.return_value = [
            Evidence(
                text="TCP provides reliable delivery and ordered packets.",
                score=0.91,
                rank_score=1.0 / 61,
                source={
                    "source_type": "internal",
                    "metadata": {
                        "document_id": "doc-1",
                        "version_id": "version-1",
                        "chunk_id": "chunk-1",
                        "course_id": "cs101",
                        "owner_ref": "user-1",
                        "chunk_index": 0,
                        "page_start": 12,
                        "page_end": 12,
                        "section_title": "Transport Layer",
                    },
                },
            ),
            Evidence(
                text="TCP retransmits lost data.",
                score=1.0,
                rank_score=1.0 / 61,
                source={
                    "source_type": "external",
                    "provider": "searxng",
                    "title": "TCP Overview",
                    "url": "https://example.com/tcp",
                },
            ),
        ]
        self.llm.generate.return_value = "TCP provides reliable delivery."

        result = self.service.generate(
            question="What does TCP provide?",
            course_id="cs101",
            document_ids=["doc-1"],
            top_k=2,
        )

        self.retrieval_service.retrieve.assert_called_once_with(
            query="What does TCP provide?",
            course_id="cs101",
            document_ids=["doc-1"],
            top_k=2,
        )

        prompt = self.llm.generate.call_args.args[0]

        self.assertIn(
            "[Internal source | document_id=doc-1 | page=12 | section=Transport Layer]",
            prompt,
        )
        self.assertIn("TCP provides reliable delivery and ordered packets.", prompt)
        self.assertIn(
            "[External source | provider=searxng | title=TCP Overview | url=https://example.com/tcp]",
            prompt,
        )
        self.assertIn("TCP retransmits lost data.", prompt)
        self.assertIn("Question:\nWhat does TCP provide?", prompt)

        self.assertEqual(result.answer, "TCP provides reliable delivery.")
        self.assertEqual(len(result.citations), 2)

        internal = result.citations[0]
        self.assertEqual(internal.source_type, "internal")
        self.assertEqual(internal.document_id, "doc-1")
        self.assertEqual(internal.version_id, "version-1")
        self.assertEqual(internal.chunk_id, "chunk-1")
        self.assertEqual(internal.owner_ref, "user-1")
        self.assertEqual(internal.page_start, 12)
        self.assertEqual(internal.page_end, 12)
        self.assertEqual(internal.section_title, "Transport Layer")

        external = result.citations[1]
        self.assertEqual(external.source_type, "external")
        self.assertEqual(external.provider, "searxng")
        self.assertEqual(external.title, "TCP Overview")
        self.assertEqual(external.url, "https://example.com/tcp")

    def test_rejects_empty_question(self) -> None:
        with self.assertRaisesRegex(ValueError, "question must not be empty"):
            self.service.generate(
                question="   ",
                course_id="cs101",
            )

        self.retrieval_service.retrieve.assert_not_called()
        self.llm.generate.assert_not_called()

    def test_returns_fallback_when_no_context_is_retrieved(self) -> None:
        self.retrieval_service.retrieve.return_value = []

        result = self.service.generate(
            question="What port does HTTPS use?",
            course_id="cs101",
        )

        self.assertEqual(
            result.answer,
            "I couldn't find enough information in the available evidence to answer that question.",
        )
        self.assertEqual(result.citations, [])
        self.llm.generate.assert_not_called()

        self.retrieval_service.retrieve.assert_called_once_with(
            query="What port does HTTPS use?",
            course_id="cs101",
            document_ids=None,
            top_k=5,
        )