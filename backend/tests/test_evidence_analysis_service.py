import json
import unittest
from unittest.mock import Mock

from src.application.evidence_analysis_service import EvidenceAnalysisService
from src.ports.llm import LLMPort, LLMResponseError
from src.schemas.retrieval import Evidence


class TestEvidenceAnalysisService(unittest.TestCase):
    def setUp(self):
        self.llm = Mock(spec=LLMPort)
        self.service = EvidenceAnalysisService(self.llm)
        self.evidence = [
            Evidence(
                evidence_id="internal:chunk-1",
                text="TCP provides reliable delivery.",
                authority="course_material",
                quality_score=1.0,
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
                evidence_id="external:searxng:reference",
                text="TCP is reliable.",
                authority="government_or_education",
                quality_score=0.9,
                source={
                    "source_type": "external",
                    "provider": "searxng",
                    "url": "https://example.edu/tcp",
                },
            ),
        ]

    def test_detects_agreement_between_independent_sources(self):
        self.llm.generate.return_value = json.dumps({
            "answer": "TCP provides reliable delivery.",
            "claims": [{
                "text": "TCP provides reliable delivery.",
                "evidence": [
                    {"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.95},
                    {"evidence_id": "external:searxng:reference", "relationship": "supports", "confidence": 0.9},
                ],
            }],
        })

        result = self.service.generate(question="What does TCP provide?", evidence=self.evidence)

        self.assertEqual(result.status, "sufficient")
        self.assertTrue(result.claims[0].has_agreement)
        self.assertFalse(result.claims[0].has_conflict)
        self.assertFalse(result.claims[0].is_insufficient)

    def test_excludes_free_form_answer_text_that_is_not_an_assessed_claim(self):
        self.llm.generate.return_value = json.dumps({
            "answer": "TCP provides reliable delivery, and the Moon is made of cheese.",
            "claims": [{
                "text": "TCP provides reliable delivery.",
                "evidence": [
                    {"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.95},
                ],
            }],
        })

        result = self.service.generate(question="What does TCP provide?", evidence=self.evidence)

        self.assertEqual(result.status, "sufficient")
        self.assertEqual(result.answer, "TCP provides reliable delivery.")
        self.assertNotIn("Moon", result.answer)

    def test_detects_conflict_without_discarding_stronger_support(self):
        self.llm.generate.return_value = json.dumps({
            "answer": "TCP provides reliable delivery.",
            "claims": [{
                "text": "TCP provides reliable delivery.",
                "evidence": [
                    {"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.95},
                    {"evidence_id": "external:searxng:reference", "relationship": "contradicts", "confidence": 0.8},
                ],
            }],
        })

        result = self.service.generate(question="What does TCP provide?", evidence=self.evidence)

        self.assertEqual(result.status, "conflicting")
        self.assertTrue(result.claims[0].has_conflict)
        self.assertFalse(result.claims[0].is_insufficient)
        self.assertTrue(result.answer.startswith("The available sources disagree"))

    def test_rejects_claim_without_reliable_support(self):
        weak_evidence = self.evidence[1].model_copy(update={"quality_score": 0.4})
        self.llm.generate.return_value = json.dumps({
            "answer": "TCP provides reliable delivery.",
            "claims": [{
                "text": "TCP provides reliable delivery.",
                "evidence": [
                    {"evidence_id": weak_evidence.evidence_id, "relationship": "supports", "confidence": 0.95},
                ],
            }],
        })

        result = self.service.generate(question="What does TCP provide?", evidence=[weak_evidence])

        self.assertEqual(result.status, "insufficient")
        self.assertTrue(result.claims[0].is_insufficient)
        self.assertIn("enough reliable information", result.answer)

    def test_reports_unresolved_contradiction_as_conflicting(self):
        self.llm.generate.return_value = json.dumps({
            "claims": [{
                "text": "TCP provides reliable delivery.",
                "evidence": [
                    {"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.8},
                    {"evidence_id": "external:searxng:reference", "relationship": "contradicts", "confidence": 1.0},
                ],
            }],
        })

        result = self.service.generate(question="What does TCP provide?", evidence=self.evidence)

        self.assertEqual(result.status, "conflicting")
        self.assertTrue(result.claims[0].has_conflict)
        self.assertTrue(result.claims[0].is_insufficient)
        self.assertIn("couldn't determine a reliable answer", result.answer)

    def test_rejects_invalid_structured_response(self):
        self.llm.generate.return_value = "not json"

        with self.assertRaises(LLMResponseError):
            self.service.generate(question="What does TCP provide?", evidence=self.evidence)


if __name__ == "__main__":
    unittest.main()
