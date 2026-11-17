import httpx

from src.ports.llm import LLMResponseError, LLMUnavailableError


class OpenAICompatibleAdapter:
    """Adapter for OpenAI-compatible chat completion APIs."""

    def __init__(self, client: httpx.Client, model: str) -> None:
        self._client = client
        self._model = model

    def generate(self, prompt: str) -> str:
        try:
            response = self._client.post("chat/completions", json={
                "model": self._model,
                "messages": [{"role": "user", "content": prompt}],
            })
            response.raise_for_status()
        except httpx.RequestError as exc:
            raise LLMUnavailableError("Inference service unavailable") from exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 or exc.response.status_code >= 500:
                raise LLMUnavailableError("Inference service temporarily unavailable") from exc
            raise LLMResponseError("Inference service rejected request") from exc

        try:
            content = response.json()["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as exc:
            raise LLMResponseError("Inference service returned an invalid response") from exc

        if not isinstance(content, str) or not content.strip():
            raise LLMResponseError("Inference service returned an empty response")

        return content.strip()