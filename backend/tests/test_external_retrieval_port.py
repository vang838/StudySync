import unittest

from src.ports.external_retrieval import ExternalRetrievalResult


class TestExternalRetrievalPort(unittest.TestCase):
    def test_external_result_preserves_source_information(self):
        result = ExternalRetrievalResult(
            text="External reference content.",
            provider="test-search",
            url="https://example.com/reference",
            title="Example Source",
            score=0.81,
        )

        self.assertEqual(result.text, "External reference content.")
        self.assertEqual(result.provider, "test-search")
        self.assertEqual(result.url, "https://example.com/reference")
        self.assertEqual(result.title, "Example Source")
        self.assertEqual(result.score, 0.81)

    def test_external_result_allows_provider_without_score(self):
        result = ExternalRetrievalResult(
            text="External reference content.",
            provider="test-search",
            url="https://example.com/reference",
        )

        self.assertIsNone(result.title)
        self.assertIsNone(result.score)


if __name__ == "__main__":
    unittest.main()