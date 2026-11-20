import json
from unittest import TestCase
from unittest.mock import Mock

from src.application.evidence_relevance_service import EvidenceRelevanceService
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
            source_policy="internal_only",
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

    def test_forwards_explicit_source_policy(self) -> None:
        self.retrieval_service.retrieve.return_value = []

        self.service.generate(
            question="Find online references about TCP.",
            course_id="CS537",
            source_policy="external_only",
        )

        self.retrieval_service.retrieve.assert_called_once_with(
            query="Find online references about TCP.",
            course_id="CS537",
            document_ids=None,
            top_k=5,
            source_policy="external_only",
        )

    def test_uses_contextual_retrieval_query(self) -> None:
        self.retrieval_service.retrieve.return_value = []

        result = self.service.generate(
            question="Explain the material from Lecture 3.",
            course_id="FILM 220",
            retrieval_query="16mm Filmmaking: Explain the material from Lecture 3.",
        )

        self.retrieval_service.retrieve.assert_called_once_with(
            query="16mm Filmmaking: Explain the material from Lecture 3.",
            course_id="FILM 220",
            document_ids=None,
            top_k=5,
            source_policy="internal_only",
        )

        self.assertEqual(result.evidence_status, "insufficient")
        self.llm.generate.assert_not_called()


    def test_filters_internal_evidence_before_generation(self) -> None:
        relevant = Evidence(
            text="TCP sequence numbers keep received segments in order.",
            quality_score=1.0,
            source={
                "source_type": "internal",
                "metadata": {
                    "document_id": "doc-1",
                    "version_id": "version-1",
                    "chunk_id": "relevant",
                    "course_id": "CS537",
                    "chunk_index": 0,
                },
            },
        )
        irrelevant = relevant.model_copy(deep=True)
        irrelevant.evidence_id = "internal:irrelevant"
        irrelevant.text = "The CPU scheduler selects runnable processes."

        self.retrieval_service.retrieve.return_value = [relevant, irrelevant]

        relevance_service = Mock(spec=EvidenceRelevanceService)
        relevance_service.filter.return_value = [relevant]

        service = RAGService(
            retrieval_service=self.retrieval_service,
            llm=self.llm,
            relevance_service=relevance_service,
        )

        self.llm.generate.return_value = json.dumps({
            "claims": [{
                "text": "TCP sequence numbers keep segments in order.",
                "evidence": [{
                    "evidence_id": relevant.evidence_id,
                    "relationship": "supports",
                    "confidence": 0.95,
                }],
            }],
        })

        result = service.generate(
            question="How does TCP preserve ordering?",
            course_id="CS537",
            retrieval_query="Networking: TCP packet ordering",
        )

        relevance_service.filter.assert_called_once_with(
            question="Networking: TCP packet ordering",
            evidence=[relevant, irrelevant],
        )

        prompt = self.llm.generate.call_args.args[0]
        self.assertIn(relevant.evidence_id, prompt)
        self.assertNotIn(irrelevant.evidence_id, prompt)
        self.assertEqual(result.evidence_status, "sufficient")
        self.assertEqual(len(result.citations), 1)
        self.assertEqual(result.citations[0].evidence_id, relevant.evidence_id)

    def test_returns_insufficient_when_all_candidates_are_rejected(self) -> None:
        evidence = Evidence(
            text="Unrelated course material.",
            source={
                "source_type": "internal",
                "metadata": {
                    "document_id": "doc-1",
                    "version_id": "version-1",
                    "chunk_id": "unrelated",
                    "course_id": "CS537",
                    "chunk_index": 0,
                },
            },
        )
        self.retrieval_service.retrieve.return_value = [evidence]

        relevance_service = Mock(spec=EvidenceRelevanceService)
        relevance_service.filter.return_value = []

        service = RAGService(
            retrieval_service=self.retrieval_service,
            llm=self.llm,
            relevance_service=relevance_service,
        )

        result = service.generate(question="Explain TCP.", course_id="CS537")

        self.assertEqual(result.evidence_status, "insufficient")
        self.assertEqual(result.citations, [])
        self.assertEqual(result.claims, [])
        self.llm.generate.assert_not_called()

    def test_external_retrieval_skips_relevance_filter(self) -> None:
        evidence = Evidence(
            text="TCP is a connection-oriented transport protocol.",
            quality_score=0.9,
            source={
                "source_type": "external",
                "provider": "searxng",
                "url": "https://example.edu/tcp",
            },
        )
        self.retrieval_service.retrieve.return_value = [evidence]

        relevance_service = Mock(spec=EvidenceRelevanceService)
        service = RAGService(
            retrieval_service=self.retrieval_service,
            llm=self.llm,
            relevance_service=relevance_service,
        )

        self.llm.generate.return_value = json.dumps({
            "claims": [{
                "text": "TCP is a connection-oriented transport protocol.",
                "evidence": [{
                    "evidence_id": evidence.evidence_id,
                    "relationship": "supports",
                    "confidence": 0.95,
                }],
            }],
        })

        result = service.generate(
            question="Search the web for TCP information.",
            course_id="CS537",
            source_policy="external_only",
        )

        relevance_service.filter.assert_not_called()
        self.assertEqual(result.evidence_status, "sufficient")
        self.assertEqual(len(result.citations), 1)

if __name__ == "__main__":
    import unittest

    unittest.main()
