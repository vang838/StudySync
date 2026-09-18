from collections.abc import Generator

from ollama import Client

from src.adapters.llm.ollama import OllamaAdapter
from src.application.chat_service import ChatService
from src.core.config import settings

def get_chat_service() -> Generator[ChatService, None, None]:
    """Create configured AI service"""
    if settings.ai_provider != "ollama":
        raise RuntimeError(f"Unsupported AI provider: {settings.ai_provider}")

    with Client(host=settings.ai_base_url, timeout=settings.ai_timeout) as client:
        llm = OllamaAdapter(client=client, model=settings.ai_model,)

        yield ChatService(llm=llm)