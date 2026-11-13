import math
import httpx
from src.ports.embedding import EmbeddingResponseError, EmbeddingUnavailableError

class CloudflareEmbeddingAdapter:
    """Cloudflare Workers AI adapter for Qwen3 document and query embeddings."""

    _QUERY_INSTRUCTION = "Given a student question, retrieve relevant course passages that answer the question."

    def __init__(self, client: httpx.Client, model: str, dimension: int) -> None:
        self._client = client
        self._model = model
        self._dimension = dimension

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts: return []
        return self._request({"documents": texts}, expected_count=len(texts))

    def embed_query(self, text: str) -> list[float]:
        return self._request({"queries": [text], "instruction": self._QUERY_INSTRUCTION}, expected_count=1)[0]

    def _request(self, payload: dict, expected_count: int) -> list[list[float]]:
        try:
            response = self._client.post(self._model, json=payload)
            response.raise_for_status()
        except httpx.RequestError as exc:
            raise EmbeddingUnavailableError("Embedding service unavailable") from exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429 or exc.response.status_code >= 500:
                raise EmbeddingUnavailableError("Embedding service temporarily unavailable") from exc
            raise EmbeddingResponseError("Embedding request rejected") from exc

        try:
            vectors = response.json()["result"]["data"]
        except (ValueError, TypeError, KeyError) as exc:
            raise EmbeddingResponseError("Embedding service returned an invalid response") from exc

        if (not isinstance(vectors, list) or len(vectors) != expected_count or
            any(not isinstance(vector, list) or len(vector) != self._dimension or
                any(type(value) not in (int, float) or not math.isfinite(value) for value in vector)
                for vector in vectors)):
            raise EmbeddingResponseError("Embedding service returned invalid vectors")

        return vectors