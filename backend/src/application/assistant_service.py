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

    def generate(self, *, question: str, course_id: str | None = None, hint_level: int | None = None) -> AssistantResult:
        question = question.strip()

        if not question:
            raise ValueError("question must not be empty")

        if hint_level is not None:
            hint_prompts = {
                1: "Give only a brief conceptual hint. Do not reveal the answer.",
                2: "Give a stronger hint with a clearer direction. Do not reveal the answer.",
                3: "Explain the relevant concepts and reasoning step by step.",
                4: "Provide deeper guidance with a detailed explanation and examples.",
            }

            if hint_level not in hint_prompts:
                raise ValueError("Invalid hint level")

            guided_question = (
                f"{hint_prompts[hint_level]}\n\n"
                f"Student question: {question}"
            )

        if not course_id or not course_id.strip():
            return AssistantResult(
                answer=self._llm.generate(guided_question if hint_level is not None else question),
                mode="general",
                citations=[],
            )

        course_id = course_id.strip()
        mode = self._classify(question)

        if mode == "course":
            result = self._rag_service.generate(question=question, course_id=course_id, hint_level=hint_level)
            return AssistantResult(
                answer=result.answer,
                mode="course",
                citations=result.citations,
                claims=result.claims,
                evidence_status=result.evidence_status,
            )

        return AssistantResult(
            answer=self._llm.generate(guided_question if hint_level is not None else question),
            mode="general",
            citations=[],
        )

    def _classify(self, question: str) -> Literal["general", "course"]:
        prompt = (
            "Classify whether the user's question requires the current course material to answer correctly.\n"
            "Return exactly COURSE or GENERAL.\n"
            "COURSE: the question refers to an assignment, problem, lecture, uploaded material, course-specific content, "
            "or otherwise depends on the current course context.\n"
            "GENERAL: the question can be answered without using the current course material.\n\n"
            f"Question:\n{question}"
        )

        result = self._llm.generate(prompt).strip().upper()
        return "course" if result == "COURSE" else "general"
