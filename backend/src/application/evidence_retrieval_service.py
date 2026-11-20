from src.application.document_retrieval_service import DocumentRetrievalService
from src.application.evidence_ranking_service import EvidenceRankingService
from src.application.evidence_service import EvidenceService
from src.application.source_quality_service import SourceQualityService
from src.ports.external_retrieval import ExternalRetrievalPort
from src.schemas.retrieval import Evidence

from typing import Literal

SourcePolicy = Literal["internal_only", "external_fallback", "external_only"]

class EvidenceRetrievalService:
    """Retrieve, normalize, quality-score, and rank evidence."""

    def __init__(
        self,
        document_retrieval: DocumentRetrievalService,
        external_retrieval: ExternalRetrievalPort,
        evidence_service: EvidenceService,
        ranking_service: EvidenceRankingService,
        quality_service: SourceQualityService | None = None,
    ) -> None:
        self._document_retrieval = document_retrieval
        self._external_retrieval = external_retrieval
        self._evidence_service = evidence_service
        self._ranking_service = ranking_service
        self._quality_service = quality_service or SourceQualityService()


    def retrieve(
        self,
        *,
        query: str,
        course_id: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
        source_policy: SourcePolicy = "internal_only",
    ) -> list[Evidence]:
        if source_policy not in ("internal_only", "external_fallback", "external_only"):
            raise ValueError(f"Unsupported source policy: {source_policy}")

        if top_k <= 0: raise ValueError("top_k must be greater than zero")

        if source_policy == "external_only" and document_ids is not None:
            raise ValueError("External-only retrieval cannot be scoped to document IDs")

        if source_policy != "external_only":
            internal_results = self._document_retrieval.retrieve(
                query=query,
                course_id=course_id,
                document_ids=document_ids,
                top_k=top_k,
            )

            internal_evidence = self._quality_service.evaluate_all([
                self._evidence_service.from_internal(result)
                for result in internal_results
            ])

            if internal_evidence or source_policy == "internal_only" or document_ids is not None:
                return self._ranking_service.rank([internal_evidence], top_k=top_k)

        external_results = self._external_retrieval.search(query, top_k=top_k)
        external_evidence = self._quality_service.evaluate_all([
            self._evidence_service.from_external(result)
            for result in external_results
        ])

        return self._ranking_service.rank([external_evidence], top_k=top_k)
