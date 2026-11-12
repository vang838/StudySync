import httpx
from src.ports.embedding import (
    EmbeddingResponseError,
    EmbeddingUnavailableError,
)

class CloudflareEmbeddingAdapter:
    """Adapter for Cloudflare Embedded Model"""
    def __init__(self,
        client: Client,
        model: str,
        dimension: int,
        query_instruction: str = (
            "Given a student question, retrieve relevant passages "
            "from course materials that answer the question"
        ),) -> None:
        self._client = client
        self._model = model
        self._dimension = dimension
        self._query_instruction = query_instruction
    
    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        
        response = self._client.embed(model=_client.model, )