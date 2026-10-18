import httpx

from src.ports.external_retrieval import (
    ExternalRetrievalResponseError,
    ExternalRetrievalResult,
    ExternalRetrievalUnavailableError,
)


class SearXNGExternalRetrievalAdapter:
    """Adapter for retrieving external search results through SearXNG."""

    def __init__(self, client: httpx.Client) -> None:
        self._client = client

    def search(self, query: str, top_k: int = 5) -> list[ExternalRetrievalResult]:
        query = query.strip()

        if not query:
            raise ValueError("External retrieval query must not be empty")

        if top_k <= 0:
            raise ValueError("top_k must be greater than zero")

        try:
            response = self._client.get("search", params={"q": query, "format": "json"})
            response.raise_for_status()
        except httpx.RequestError as exc:
            raise ExternalRetrievalUnavailableError("External retrieval service unavailable") from exc
        except httpx.HTTPStatusError as exc:
            raise ExternalRetrievalResponseError("External retrieval service rejected request") from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise ExternalRetrievalResponseError("External retrieval service returned invalid JSON") from exc

        if not isinstance(payload, dict) or not isinstance(payload.get("results"), list):
            raise ExternalRetrievalResponseError("External retrieval service returned invalid response")

        results: list[ExternalRetrievalResult] = []

        for item in payload["results"]:
            if not isinstance(item, dict):
                raise ExternalRetrievalResponseError("External retrieval service returned invalid result")

            title = item.get("title")
            url = item.get("url")
            content = item.get("content")
            score = item.get("score")

            if not isinstance(url, str) or not url.strip():
                continue

            text = content.strip() if isinstance(content, str) and content.strip() else None

            if text is None and isinstance(title, str) and title.strip():
                text = title.strip()

            if text is None:
                continue

            if not isinstance(score, (int, float)):
                score = None

            results.append(
                ExternalRetrievalResult(
                    text=text,
                    provider="searxng",
                    url=url.strip(),
                    title=title.strip() if isinstance(title, str) and title.strip() else None,
                    score=float(score) if score is not None else None,
                )
            )

            if len(results) >= top_k:
                break

        return results