from dataclasses import dataclass
from typing import Protocol


VectorMetadataValue = str | int | float | bool | list[str]


class VectorStoreError(Exception):
    """Base exception for vector-store failures."""


class VectorStoreUnavailableError(VectorStoreError):
    """Raised when the vector store cannot be reached."""


class VectorStoreResponseError(VectorStoreError):
    """Raised when the vector store rejects or returns an invalid response."""


@dataclass(frozen=True)
class VectorRecord:
    record_id: str
    vector: list[float]
    metadata: dict[str, VectorMetadataValue]


@dataclass(frozen=True)
class VectorSearchResult:
    record_id: str
    score: float
    metadata: dict[str, VectorMetadataValue]


class VectorStorePort(Protocol):
    """Provider-independent interface for vector persistence and search."""

    def upsert(self, records: list[VectorRecord]) -> int:
        """Store vector records and return the number accepted."""

    def search(
        self,
        query_vector: list[float],
        top_k: int,
        metadata_filter: dict[str, object] | None = None,
    ) -> list[VectorSearchResult]:
        """Return records ranked by similarity to the query vector."""