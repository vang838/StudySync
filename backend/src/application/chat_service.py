from src.ports.llm import LLMPort

class ChatService:
    """Coordinate AI response gen."""
    def __init__(self, llm: LLMPort) -> None:
        self._llm = llm

    def generate_ans(self, question: str) -> str:
        """Gen answer usign configured LLM."""
        return self._llm.generate(question)