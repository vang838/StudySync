from typing import Protocol


class EmbeddingError(Exception):
    """Base exception for embedding failures."""


class EmbeddingUnavailableError(EmbeddingError):
    """Exception raised when embedding service is unavailable."""


class EmbeddingResponseError(EmbeddingError):
    """Exception raised when embedding service returns an invalid response."""


class EmbeddingPort(Protocol):
    """Provider-independent interface for generating text embeddings."""

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Generate one embedding vector for each document text."""

    def embed_query(self, query: str) -> list[float]:
        """Generate an embedding for a retrieval query."""