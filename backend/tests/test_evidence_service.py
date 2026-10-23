import unittest

from src.application.document_retrieval_service import RetrievedChunk
from src.application.evidence_service import EvidenceService
from src.ports.external_retrieval import ExternalRetrievalResult
from src.schemas.retrieval import ExternalEvidenceSource, InternalEvidenceSource


class TestEvidenceService(unittest.TestCase):
    def setUp(self):
        self.service = EvidenceService()

    def test_normalizes_internal_chunk(self):
        chunk = RetrievedChunk(
            chunk_id="chunk-1",
            text="Internal course content.",
            score=0.92,
            metadata={
                "document_id": "doc-1",
                "version_id": "version-1",
                "chunk_id": "chunk-1",
                "course_id": "CS537",
                "chunk_index": 2,
                "page_start": 4,
            },
        )

        evidence = self.service.from_internal(chunk)

        self.assertEqual(evidence.text, "Internal course content.")
        self.assertEqual(evidence.score, 0.92)
        self.assertIsInstance(evidence.source, InternalEvidenceSource)
        self.assertEqual(evidence.source.metadata.document_id, "doc-1")
        self.assertEqual(evidence.source.metadata.page_start, 4)

    def test_normalizes_external_result(self):
        result = ExternalRetrievalResult(
            text="External reference content.",
            provider="searxng",
            url="https://example.com/reference",
            title="Example Source",
            score=0.5,
        )

        evidence = self.service.from_external(result)

        self.assertEqual(evidence.text, "External reference content.")
        self.assertEqual(evidence.score, 0.5)
        self.assertIsInstance(evidence.source, ExternalEvidenceSource)
        self.assertEqual(evidence.source.provider, "searxng")
        self.assertEqual(evidence.source.url, "https://example.com/reference")

    def test_external_evidence_allows_missing_score(self):
        result = ExternalRetrievalResult(
            text="External reference content.",
            provider="searxng",
            url="https://example.com/reference",
        )

        evidence = self.service.from_external(result)

        self.assertIsNone(evidence.score)


if __name__ == "__main__":
    unittest.main()