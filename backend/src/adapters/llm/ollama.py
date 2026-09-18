import httpx

from ollama import Client, ResponseError, ResponseError

from src.ports.llm import (
    LLMResponseError,
    LLMUnavailableError,
)

class OllamaAdapter:
    """Adapter for generating text through ollama server."""
    def __init__(self, client: Client, model: str) -> None:
        self._client = client
        self._model = model

    def generate(self, prompt: str) -> str:
        """Gen response using configured model."""
        try:
            response = self._client.chat(
                model=self._model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                stream=False,
            )
        except ResponseError as exc:
            raise LLMResponseError("Inference service rejected request") from exc

        except (httpx.RequestError, ConnectionError) as exc:
            raise LLMUnavailableError("Inference service unavailable") from exc

        try:
            answer = response.message.content
            if not isinstance(answer, str) or not answer.strip():
                raise LLMResponseError("Inference service returned empty/invalid response")
            return answer

        except (AttributeError, TypeError) as exc:
            raise LLMResponseError("Inference service returned invalid response") from exc
