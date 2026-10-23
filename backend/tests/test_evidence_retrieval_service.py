import unittest

from src.application.document_retrieval_service import RetrievedChunk
from src.application.evidence_retrieval_service import EvidenceRetrievalService
from src.application.evidence_service import EvidenceService
from src.ports.external_retrieval import ExternalRetrievalResult
from src.schemas.retrieval import ExternalEvidenceSource, InternalEvidenceSource

from src.application.evidence_ranking_service import EvidenceRankingService

class FakeDocumentRetrievalService:
    def retrieve(self, *, query: str, course_id: str, document_ids: list[str] | None = None, top_k: int = 5):
        return [
            RetrievedChunk(
                chunk_id="chunk-1",
                text="Internal course content.",
                score=0.9,
                metadata={
                    "document_id": "doc-1",
                    "version_id": "version-1",
                    "chunk_id": "chunk-1",
                    "course_id": course_id,
                    "chunk_index": 0,
                },
            )
        ]


class FakeExternalRetrievalAdapter:
    def search(self, query: str, top_k: int = 5):
        return [
            ExternalRetrievalResult(
                text="External reference content.",
                provider="searxng",
                url="https://example.com/reference",
                title="Example Source",
                score=1.0,
            )
        ]


class TestEvidenceRetrievalService(unittest.TestCase):
    def setUp(self):
        self.service = EvidenceRetrievalService(
            FakeDocumentRetrievalService(),
            FakeExternalRetrievalAdapter(),
            EvidenceService(),
            EvidenceRankingService(),
        )

    def test_retrieves_internal_and_external_evidence(self):
        results = self.service.retrieve(
            query="virtual memory",
            course_id="CS537",
            top_k=5,
        )

        self.assertEqual(len(results), 2)

        self.assertIsInstance(results[0].source, InternalEvidenceSource)
        self.assertEqual(results[0].text, "Internal course content.")
        self.assertEqual(results[0].source.metadata.document_id, "doc-1")

        self.assertIsInstance(results[1].source, ExternalEvidenceSource)
        self.assertEqual(results[1].text, "External reference content.")
        self.assertEqual(results[1].source.provider, "searxng")
        self.assertEqual(results[1].source.url, "https://example.com/reference")

        self.assertIsNotNone(results[0].rank_score)
        self.assertIsNotNone(results[1].rank_score)

if __name__ == "__main__":
    unittest.main()