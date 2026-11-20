import json
from unittest import TestCase
from unittest.mock import Mock

from src.application.evidence_relevance_service import EvidenceRelevanceService
from src.ports.llm import LLMPort, LLMResponseError
from src.schemas.retrieval import Evidence


class TestEvidenceRelevanceService(TestCase):
    def setUp(self) -> None:
        self.llm = Mock(spec=LLMPort)
        self.service = EvidenceRelevanceService(self.llm)

        self.evidence = [
            self._evidence("chunk-1", "TCP sequence numbers maintain ordered delivery."),
            self._evidence("chunk-2", "The operating system schedules CPU processes."),
            self._evidence("chunk-3", "TCP retransmits lost segments for reliability."),
        ]

    @staticmethod
    def _evidence(chunk_id: str, text: str) -> Evidence:
        return Evidence(
            text=text,
            source={
                "source_type": "internal",
                "metadata": {
                    "document_id": "doc-1",
                    "version_id": "version-1",
                    "chunk_id": chunk_id,
                    "course_id": "CS537",
                    "chunk_index": 0,
                },
            },
        )

    def test_filters_irrelevant_evidence(self) -> None:
        selected = [self.evidence[0].evidence_id, self.evidence[2].evidence_id]
        self.llm.generate.return_value = json.dumps({"relevant_evidence_ids": selected})

        results = self.service.filter(
            question="How does TCP deliver data reliably?",
            evidence=self.evidence,
        )

        self.assertEqual([item.evidence_id for item in results], selected)
        prompt = self.llm.generate.call_args.args[0]
        self.assertIn("How does TCP deliver data reliably?", prompt)

    def test_preserves_original_ranking_order(self) -> None:
        self.llm.generate.return_value = json.dumps({
            "relevant_evidence_ids": [
                self.evidence[2].evidence_id,
                self.evidence[0].evidence_id,
            ],
        })

        results = self.service.filter(question="Explain TCP.", evidence=self.evidence)

        self.assertEqual(results, [self.evidence[0], self.evidence[2]])

    def test_returns_empty_when_nothing_is_relevant(self) -> None:
        self.llm.generate.return_value = '{"relevant_evidence_ids":[]}'

        results = self.service.filter(question="Explain DNS.", evidence=self.evidence)

        self.assertEqual(results, [])

    def test_empty_evidence_skips_inference(self) -> None:
        self.assertEqual(self.service.filter(question="Explain TCP.", evidence=[]), [])
        self.llm.generate.assert_not_called()

    def test_rejects_unknown_evidence_ids(self) -> None:
        self.llm.generate.return_value = '{"relevant_evidence_ids":["internal:unknown"]}'

        with self.assertRaises(LLMResponseError):
            self.service.filter(question="Explain TCP.", evidence=self.evidence)

    def test_rejects_malformed_response(self) -> None:
        self.llm.generate.return_value = "not valid json"

        with self.assertRaises(LLMResponseError):
            self.service.filter(question="Explain TCP.", evidence=self.evidence)

    def test_accepts_fenced_json_response(self) -> None:
        self.llm.generate.return_value = (
            "```json\n"
            '{"relevant_evidence_ids":["internal:chunk-1"]}\n'
            "```"
        )

        results = self.service.filter(question="Explain TCP.", evidence=self.evidence)

        self.assertEqual(results, [self.evidence[0]])
