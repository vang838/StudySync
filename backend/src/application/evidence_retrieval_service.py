from src.application.document_retrieval_service import DocumentRetrievalService
from src.application.evidence_service import EvidenceService
from src.ports.external_retrieval import ExternalRetrievalPort
from src.schemas.retrieval import Evidence

from src.application.evidence_ranking_service import EvidenceRankingService

class EvidenceRetrievalService:
    """Retrieve and normalize evidence from internal and external sources."""

    def __init__(self, document_retrieval: DocumentRetrievalService, external_retrieval: ExternalRetrievalPort, evidence_service: EvidenceService, ranking_service: EvidenceRankingService) -> None:
        self._document_retrieval = document_retrieval
        self._external_retrieval = external_retrieval
        self._evidence_service = evidence_service
        self._ranking_service = ranking_service

    def retrieve(self, *, query: str, course_id: str, document_ids: list[str] | None = None, top_k: int = 5) -> list[Evidence]:
        internal_results = self._document_retrieval.retrieve(
            query=query,
            course_id=course_id,
            document_ids=document_ids,
            top_k=top_k,
        )
        external_results = self._external_retrieval.search(query, top_k=top_k)

        internal_evidence = [
            self._evidence_service.from_internal(result)
            for result in internal_results
        ]
        external_evidence = [
            self._evidence_service.from_external(result)
            for result in external_results
        ]

        return self._ranking_service.rank([internal_evidence, external_evidence], top_k=top_k)