from dataclasses import dataclass
from typing import Protocol


class ExternalRetrievalError(Exception):
    """Base exception for external retrieval failures."""


class ExternalRetrievalUnavailableError(ExternalRetrievalError):
    """Raised when the external retrieval service cannot be reached."""


class ExternalRetrievalResponseError(ExternalRetrievalError):
    """Raised when external retrieval returns an invalid response."""


@dataclass(frozen=True)
class ExternalRetrievalResult:
    text: str
    provider: str
    url: str
    title: str | None = None
    score: float | None = None


class ExternalRetrievalPort(Protocol):
    """Provider-independent interface for retrieving external information."""

    def search(self, query: str, top_k: int = 5) -> list[ExternalRetrievalResult]:
        """Return external results relevant to the query."""