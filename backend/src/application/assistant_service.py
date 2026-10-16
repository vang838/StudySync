from dataclasses import dataclass
from typing import Literal

from src.application.rag_service import RAGService
from src.ports.llm import LLMPort


@dataclass(frozen=True)
class AssistantResult:
    answer: str
    mode: Literal["general", "course"]


class AssistantService:
    """Route assistant questions between general generation and course RAG."""

    def __init__(self, llm: LLMPort, rag_service: RAGService) -> None:
        self._llm = llm
        self._rag_service = rag_service

    def generate(self, *, question: str, course_id: str | None = None) -> AssistantResult:
        question = question.strip()

        if not question:
            raise ValueError("question must not be empty")

        if not course_id or not course_id.strip():
            return AssistantResult(answer=self._llm.generate(question), mode="general")

        course_id = course_id.strip()
        mode = self._classify(question)

        if mode == "course":
            answer = self._rag_service.generate(question=question, course_id=course_id)
            return AssistantResult(answer=answer, mode="course")

        return AssistantResult(answer=self._llm.generate(question), mode="general")

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