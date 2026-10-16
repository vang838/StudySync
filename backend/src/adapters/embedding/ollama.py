import httpx
from ollama import Client, ResponseError

from src.ports.embedding import (
    EmbeddingResponseError,
    EmbeddingUnavailableError,
)


class OllamaEmbeddingAdapter:
    """Adapter for generating embeddings through an Ollama server."""

    def __init__(
        self,
        client: Client,
        model: str,
        dimension: int,
        query_instruction: str = (
            "Given a student question, retrieve relevant passages "
            "from course materials that answer the question"
        ),
    ) -> None:
        self._client = client
        self._model = model
        self._dimension = dimension
        self._query_instruction = query_instruction

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings using the configured model."""
        if not texts:
            return []

        try:
            response = self._client.embed(model=self._model, input=texts,)
            
        except ResponseError as exc:
            raise EmbeddingResponseError("Embedding service rejected request") from exc
            
        except (httpx.RequestError, ConnectionError) as exc:
            raise EmbeddingUnavailableError("Embedding service unavailable") from exc

        try:
            embeddings = response.embeddings

            if len(embeddings) != len(texts):
                raise EmbeddingResponseError("Embedding service returned unexpected embedding count")

            vectors = [list(vector) for vector in embeddings]
            if any(len(vector) != self._dimension for vector in vectors):
                raise EmbeddingResponseError("Embedding service returned unexpected embedding dimension")

            return vectors

        except (AttributeError, TypeError) as exc:
            raise EmbeddingResponseError("Embedding service returned invalid response") from exc
    
    def embed_query(self, query: str) -> list[float]:
        """Generate an instructed embedding for a retrieval query."""
        query = query.strip()

        if not query:
            raise EmbeddingResponseError("Embedding query must not be empty")

        instructed_query = (
            f"Instruct: {self._query_instruction}\n"
            f"Query:{query}"
        )

        return self.embed([instructed_query])[0]