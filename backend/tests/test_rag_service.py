import json
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
        self.service = RAGService(
            retrieval_service=self.retrieval_service,
            llm=self.llm,
        )

    def test_returns_only_claim_associated_citations(self) -> None:
        self.retrieval_service.retrieve.return_value = [
            Evidence(
                evidence_id="internal:chunk-1",
                text="TCP provides reliable delivery and ordered packets.",
                score=0.91,
                authority="course_material",
                quality_score=1.0,
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
                evidence_id="external:searxng:tcp",
                text="TCP retransmits lost data.",
                score=1.0,
                authority="government_or_education",
                quality_score=0.9,
                source={
                    "source_type": "external",
                    "provider": "searxng",
                    "title": "TCP Overview",
                    "url": "https://example.edu/tcp",
                },
            ),
            Evidence(
                evidence_id="external:searxng:unused",
                text="An unrelated networking fact.",
                score=0.8,
                authority="general_web",
                quality_score=0.6,
                source={
                    "source_type": "external",
                    "provider": "searxng",
                    "title": "Unrelated",
                    "url": "https://example.com/unrelated",
                },
            ),
        ]
        self.llm.generate.return_value = json.dumps({
            "answer": "TCP provides reliable delivery.",
            "claims": [{
                "text": "TCP provides reliable delivery.",
                "evidence": [
                    {"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.95},
                    {"evidence_id": "external:searxng:tcp", "relationship": "supports", "confidence": 0.85},
                    {"evidence_id": "external:searxng:unused", "relationship": "irrelevant", "confidence": 0.9},
                ],
            }],
        })

        result = self.service.generate(
            question="What does TCP provide?",
            course_id="cs101",
            document_ids=["doc-1"],
            top_k=3,
        )

        self.retrieval_service.retrieve.assert_called_once_with(
            query="What does TCP provide?",
            course_id="cs101",
            document_ids=["doc-1"],
            top_k=3,
        )
        prompt = self.llm.generate.call_args.args[0]
        self.assertIn('"evidence_id": "internal:chunk-1"', prompt)
        self.assertIn("Question:\nWhat does TCP provide?", prompt)

        self.assertEqual(result.answer, "TCP provides reliable delivery.")
        self.assertEqual(result.evidence_status, "sufficient")
        self.assertTrue(result.claims[0].has_agreement)
        self.assertEqual(len(result.citations), 2)
        self.assertEqual(result.citations[0].evidence_id, "internal:chunk-1")
        self.assertEqual(result.citations[0].claim_ids, ["claim-1"])
        self.assertEqual(result.citations[1].evidence_id, "external:searxng:tcp")

    def test_rejects_empty_question(self) -> None:
        with self.assertRaisesRegex(ValueError, "question must not be empty"):
            self.service.generate(question="   ", course_id="cs101")

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
        self.assertEqual(result.evidence_status, "insufficient")
        self.llm.generate.assert_not_called()


if __name__ == "__main__":
    import unittest

    unittest.main()
