from dataclasses import dataclass, field
from typing import Literal

from src.application.rag_service import RAGService
from src.ports.llm import LLMPort
from src.schemas.retrieval import Citation, GeneratedClaim


@dataclass(frozen=True)
class AssistantResult:
    answer: str
    mode: Literal["general", "course"]
    citations: list[Citation]
    claims: list[GeneratedClaim] = field(default_factory=list)
    evidence_status: Literal["not_applicable", "sufficient", "conflicting", "insufficient"] = "not_applicable"


class AssistantService:
    """Route assistant questions between general generation and course RAG."""

    def __init__(self, llm: LLMPort, rag_service: RAGService) -> None:
        self._llm = llm
        self._rag_service = rag_service

    
    def generate(
        self, *, question: str, course_id: str | None = None, hint_level: int | None = None,
        user_id: int | None = None, document_ids: list[str] | None = None,
        source_scope: Literal["documents", "external", "both"] = "both",
    ) -> AssistantResult:
        question = question.strip()

        if not question: raise ValueError("question must not be empty")

        guided_question = question
        if hint_level is not None:
            hint_prompts = {
                1: "Give only a brief conceptual hint. Do not reveal the answer.",
                2: "Give a stronger hint with a clearer direction. Do not reveal the answer.",
                3: "Explain the relevant concepts and reasoning step by step.",
                4: "Provide deeper guidance with a detailed explanation and examples.",
            }

            if hint_level not in hint_prompts: raise ValueError("Invalid hint level")

            guided_question = f"{hint_prompts[hint_level]}\n\nStudent question: {question}"

        if source_scope not in ("documents", "external", "both"):
            raise ValueError("Invalid source scope")

        if document_ids is not None and source_scope == "external":
            raise ValueError("Document selection requires document retrieval.")

        if not course_id or not course_id.strip():
            if document_ids is not None or source_scope != "both":
                raise ValueError("A course must be selected for retrieval.")

            return AssistantResult(
                answer=self._llm.generate(guided_question),
                mode="general",
                citations=[],
            )

        if user_id is None or user_id <= 0:
            raise PermissionError("Authentication required for course retrieval.")

        result = self._rag_service.generate(
            question=question,
            course_id=course_id.strip(),
            user_id=user_id,
            document_ids=document_ids,
            source_scope=source_scope,
            hint_level=hint_level,
        )

        return AssistantResult(
            answer=result.answer,
            mode="course",
            citations=result.citations,
            claims=result.claims,
            evidence_status=result.evidence_status,
        )
