from dataclasses import dataclass, field
from typing import Literal

from src.application.evidence_analysis_service import EvidenceAnalysisService
from src.application.evidence_retrieval_service import EvidenceRetrievalService
from src.ports.llm import LLMPort
from src.schemas.retrieval import (
    Citation,
    Evidence,
    ExternalCitation,
    GeneratedClaim,
    InternalCitation,
)


@dataclass(frozen=True)
class RAGResult:
    answer: str
    citations: list[Citation]
    claims: list[GeneratedClaim] = field(default_factory=list)
    evidence_status: Literal["sufficient", "conflicting", "insufficient"] = "sufficient"


class RAGService:
    """Coordinate retrieval, evidence assessment, and grounded generation."""

    def __init__(
        self,
        retrieval_service: EvidenceRetrievalService,
        llm: LLMPort,
        analysis_service: EvidenceAnalysisService | None = None,
    ) -> None:
        self._retrieval_service = retrieval_service
        self._analysis_service = analysis_service or EvidenceAnalysisService(llm)

    def generate(
        self,
        *,
        question: str,
        course_id: str,
        document_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> RAGResult:
        question = question.strip()

        if not question:
            raise ValueError("question must not be empty")

        evidence = self._retrieval_service.retrieve(
            query=question,
            course_id=course_id,
            document_ids=document_ids,
            top_k=top_k,
        )

        if not evidence:
            return RAGResult(
                answer="I couldn't find enough information in the available evidence to answer that question.",
                citations=[],
                evidence_status="insufficient",
            )

        analysis = self._analysis_service.generate(question=question, evidence=evidence)
        citations = (
            []
            if analysis.status == "insufficient"
            else self._citations_from_claims(evidence, analysis.claims)
        )

        return RAGResult(
            answer=analysis.answer,
            citations=citations,
            claims=analysis.claims,
            evidence_status=analysis.status,
        )

    @classmethod
    def _citations_from_claims(
        cls,
        evidence: list[Evidence],
        claims: list[GeneratedClaim],
    ) -> list[Citation]:
        claim_ids_by_evidence: dict[str, list[str]] = {}

        for claim in claims:
            for association in claim.evidence:
                if association.relationship == "irrelevant" or association.confidence < 0.5:
                    continue

                claim_ids = claim_ids_by_evidence.setdefault(association.evidence_id, [])
                if claim.claim_id not in claim_ids:
                    claim_ids.append(claim.claim_id)

        return [
            cls._citation_from_evidence(item, claim_ids_by_evidence[item.evidence_id])
            for item in evidence
            if item.evidence_id in claim_ids_by_evidence
        ]

    @staticmethod
    def _citation_from_evidence(evidence: Evidence, claim_ids: list[str]) -> Citation:
        source = evidence.source

        if source.source_type == "internal":
            metadata = source.metadata
            return InternalCitation(
                evidence_id=evidence.evidence_id,
                claim_ids=claim_ids,
                document_id=metadata.document_id,
                version_id=metadata.version_id,
                chunk_id=metadata.chunk_id,
                owner_ref=metadata.owner_ref,
                page_start=metadata.page_start,
                page_end=metadata.page_end,
                section_title=metadata.section_title,
            )

        return ExternalCitation(
            evidence_id=evidence.evidence_id,
            claim_ids=claim_ids,
            provider=source.provider,
            title=source.title,
            url=source.url,
        )
