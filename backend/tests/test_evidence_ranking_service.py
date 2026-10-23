import unittest

from src.application.evidence_ranking_service import EvidenceRankingService
from src.schemas.retrieval import Evidence


class TestEvidenceRankingService(unittest.TestCase):
    def setUp(self):
        self.service = EvidenceRankingService()

    def test_merges_and_ranks_evidence_groups(self):
        internal = [
            Evidence(
                text="Internal first.",
                score=0.9,
                source={
                    "source_type": "internal",
                    "metadata": {
                        "document_id": "doc-1",
                        "version_id": "version-1",
                        "chunk_id": "chunk-1",
                        "course_id": "CS537",
                        "chunk_index": 0,
                    },
                },
            ),
            Evidence(
                text="Internal second.",
                score=0.8,
                source={
                    "source_type": "internal",
                    "metadata": {
                        "document_id": "doc-1",
                        "version_id": "version-1",
                        "chunk_id": "chunk-2",
                        "course_id": "CS537",
                        "chunk_index": 1,
                    },
                },
            ),
        ]

        external = [
            Evidence(
                text="External first.",
                score=1.0,
                source={
                    "source_type": "external",
                    "provider": "searxng",
                    "title": "Example",
                    "url": "https://example.com/1",
                },
            )
        ]

        results = self.service.rank([internal, external], top_k=3)

        self.assertEqual(len(results), 3)
        self.assertEqual(results[0].text, "Internal first.")
        self.assertEqual(results[1].text, "External first.")
        self.assertEqual(results[2].text, "Internal second.")

        self.assertIsNotNone(results[0].rank_score)
        self.assertIsNotNone(results[1].rank_score)
        self.assertEqual(results[0].score, 0.9)
        self.assertEqual(results[1].score, 1.0)

    def test_limits_results_to_top_k(self):
        evidence = [
            Evidence(
                text=f"Evidence {index}",
                score=0.9,
                source={
                    "source_type": "external",
                    "provider": "searxng",
                    "url": f"https://example.com/{index}",
                },
            )
            for index in range(3)
        ]

        results = self.service.rank([evidence], top_k=2)

        self.assertEqual(len(results), 2)

    def test_rejects_invalid_top_k(self):
        with self.assertRaises(ValueError):
            self.service.rank([], top_k=0)


if __name__ == "__main__":
    unittest.main()