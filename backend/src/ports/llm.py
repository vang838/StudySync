from typing import Protocol

class LLMError(Exception):
    """Base exception for inference failures."""

class LLMUnavailableError(LLMError):
    """Exception raised when service is unavailable."""

class LLMResponseError(LLMError):
    """Exception raised when service returns an error response."""

class LLMPort(Protocol):
    """Provider independent interface for text gen"""
    def generate(self, prompt: str, *, response_schema: dict | None = None) -> str:
        """Generate text, optionally constrained to a JSON response schema."""
