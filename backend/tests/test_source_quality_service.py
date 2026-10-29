import unittest

from src.application.source_quality_service import SourceQualityService
from src.schemas.retrieval import Evidence


class TestSourceQualityService(unittest.TestCase):
    def setUp(self):
        self.service = SourceQualityService()

    def test_course_material_has_highest_authority(self):
        evidence = Evidence(
            text="Course content.",
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
        )

        result = self.service.evaluate(evidence)

        self.assertEqual(result.authority, "course_material")
        self.assertEqual(result.quality_score, 1.0)

    def test_external_authority_uses_domain_and_transport_rules(self):
        education = Evidence(
            text="Education reference.",
            source={
                "source_type": "external",
                "provider": "searxng",
                "url": "https://example.edu/reference",
            },
        )
        insecure_web = Evidence(
            text="General reference.",
            source={
                "source_type": "external",
                "provider": "searxng",
                "url": "http://example.com/reference",
            },
        )

        education_result = self.service.evaluate(education)
        insecure_result = self.service.evaluate(insecure_web)

        self.assertEqual(education_result.authority, "government_or_education")
        self.assertEqual(education_result.quality_score, 0.9)
        self.assertEqual(insecure_result.authority, "general_web")
        self.assertAlmostEqual(insecure_result.quality_score, 0.4)


if __name__ == "__main__":
    unittest.main()
