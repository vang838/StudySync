
import unittest
from unittest.mock import Mock

from src.application.document_retrieval_service import DocumentRetrievalService, RetrievedChunk
from src.application.evidence_ranking_service import EvidenceRankingService
from src.application.evidence_retrieval_service import EvidenceRetrievalService
from src.application.evidence_service import EvidenceService
from src.ports.external_retrieval import ExternalRetrievalPort, ExternalRetrievalResult
from src.schemas.retrieval import ExternalEvidenceSource, InternalEvidenceSource


class TestEvidenceRetrievalService(unittest.TestCase):
    def setUp(self):
        self.documents = Mock(spec=DocumentRetrievalService)
        self.external = Mock(spec=ExternalRetrievalPort)

        self.documents.retrieve.return_value = [
            RetrievedChunk(
                chunk_id="chunk-1",
                text="Internal course content.",
                score=0.9,
                metadata={
                    "document_id": "doc-1",
                    "version_id": "version-1",
                    "chunk_id": "chunk-1",
                    "course_id": "CS537",
                    "chunk_index": 0,
                },
            )
        ]

        self.external.search.return_value = [
            ExternalRetrievalResult(
                text="External reference content.",
                provider="searxng",
                url="https://example.com/reference",
                title="Example Source",
                score=1.0,
            )
        ]

        self.service = EvidenceRetrievalService(
            self.documents,
            self.external,
            EvidenceService(),
            EvidenceRankingService(),
        )

    def test_defaults_to_internal_only(self):
        results = self.service.retrieve(query="virtual memory", course_id="CS537")

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0].source, InternalEvidenceSource)
        self.assertEqual(results[0].source.metadata.course_id, "CS537")
        self.assertEqual(results[0].source.metadata.document_id, "doc-1")
        self.assertIsNotNone(results[0].rank_score)
        self.external.search.assert_not_called()

    def test_external_fallback_skipped_when_internal_exists(self):
        results = self.service.retrieve(
            query="virtual memory",
            course_id="CS537",
            source_policy="external_fallback",
        )

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0].source, InternalEvidenceSource)
        self.external.search.assert_not_called()

    def test_external_fallback_when_internal_is_empty(self):
        self.documents.retrieve.return_value = []

        results = self.service.retrieve(
            query="virtual memory",
            course_id="CS537",
            source_policy="external_fallback",
        )

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0].source, ExternalEvidenceSource)
        self.assertEqual(results[0].source.provider, "searxng")
        self.external.search.assert_called_once_with("virtual memory", top_k=5)

    def test_document_scoped_fallback_never_uses_external(self):
        self.documents.retrieve.return_value = []

        results = self.service.retrieve(
            query="lecture notes",
            course_id="CS537",
            document_ids=["doc-1"],
            source_policy="external_fallback",
        )

        self.assertEqual(results, [])
        self.documents.retrieve.assert_called_once_with(
            query="lecture notes",
            course_id="CS537",
            document_ids=["doc-1"],
            top_k=5,
        )
        self.external.search.assert_not_called()

    def test_explicit_external_only_skips_internal(self):
        results = self.service.retrieve(
            query="recent research",
            course_id="CS537",
            source_policy="external_only",
        )

        self.assertEqual(len(results), 1)
        self.assertIsInstance(results[0].source, ExternalEvidenceSource)
        self.documents.retrieve.assert_not_called()
        self.external.search.assert_called_once_with("recent research", top_k=5)

    def test_external_only_rejects_document_scope(self):
        with self.assertRaises(ValueError):
            self.service.retrieve(
                query="lecture notes",
                course_id="CS537",
                document_ids=["doc-1"],
                source_policy="external_only",
            )

        self.documents.retrieve.assert_not_called()
        self.external.search.assert_not_called()

    def test_rejects_invalid_policy(self):
        with self.assertRaises(ValueError):
            self.service.retrieve(
                query="virtual memory",
                course_id="CS537",
                source_policy="invalid",
            )
