import unittest

from src.schemas.retrieval import Evidence, ExternalEvidenceSource, InternalEvidenceSource


class TestEvidenceSchemas(unittest.TestCase):
    def test_internal_evidence_preserves_document_provenance(self):
        evidence = Evidence.model_validate(
            {
                "text": "Virtual memory allows processes to use virtual address spaces.",
                "score": 0.92,
                "source": {
                    "source_type": "internal",
                    "metadata": {
                        "document_id": "doc-1",
                        "version_id": "version-1",
                        "chunk_id": "chunk-1",
                        "course_id": "CS537",
                        "chunk_index": 3,
                        "page_start": 12,
                        "page_end": 13,
                        "section_title": "Virtual Memory",
                    },
                },
            }
        )

        self.assertIsInstance(evidence.source, InternalEvidenceSource)
        self.assertEqual(evidence.source.source_type, "internal")
        self.assertEqual(evidence.source.metadata.document_id, "doc-1")
        self.assertEqual(evidence.source.metadata.chunk_id, "chunk-1")
        self.assertEqual(evidence.source.metadata.page_start, 12)

    def test_external_evidence_preserves_external_provenance(self):
        evidence = Evidence.model_validate(
            {
                "text": "External reference content.",
                "score": 0.81,
                "source": {
                    "source_type": "external",
                    "provider": "test-search",
                    "title": "Example Source",
                    "url": "https://example.com/reference",
                },
            }
        )

        self.assertIsInstance(evidence.source, ExternalEvidenceSource)
        self.assertEqual(evidence.source.source_type, "external")
        self.assertEqual(evidence.source.provider, "test-search")
        self.assertEqual(evidence.source.url, "https://example.com/reference")


if __name__ == "__main__":
    unittest.main()