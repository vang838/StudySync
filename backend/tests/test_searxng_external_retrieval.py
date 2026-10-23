import unittest

import httpx

from src.adapters.external_retrieval.searxng import SearXNGExternalRetrievalAdapter
from src.ports.external_retrieval import (
    ExternalRetrievalResponseError,
    ExternalRetrievalUnavailableError,
)


class TestSearXNGExternalRetrievalAdapter(unittest.TestCase):
    def test_returns_normalized_search_results(self):
        def handler(request: httpx.Request) -> httpx.Response:
            self.assertEqual(request.url.path, "/search")
            self.assertEqual(request.url.params["q"], "virtual memory")
            self.assertEqual(request.url.params["format"], "json")

            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "title": "Virtual Memory",
                            "url": "https://example.com/virtual-memory",
                            "content": "Virtual memory provides processes with virtual address spaces.",
                            "score": 2.5,
                        }
                    ]
                },
            )

        with httpx.Client(base_url="http://searxng.test/", transport=httpx.MockTransport(handler)) as client:
            adapter = SearXNGExternalRetrievalAdapter(client)
            results = adapter.search("virtual memory")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].provider, "searxng")
        self.assertEqual(results[0].title, "Virtual Memory")
        self.assertEqual(results[0].url, "https://example.com/virtual-memory")
        self.assertEqual(results[0].score, 2.5)

    def test_limits_results_to_top_k(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                200,
                json={
                    "results": [
                        {"title": "One", "url": "https://example.com/1", "content": "Result one."},
                        {"title": "Two", "url": "https://example.com/2", "content": "Result two."},
                    ]
                },
            )

        with httpx.Client(base_url="http://searxng.test/", transport=httpx.MockTransport(handler)) as client:
            adapter = SearXNGExternalRetrievalAdapter(client)
            results = adapter.search("query", top_k=1)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].title, "One")

    def test_translates_connection_failure(self):
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("Connection failed", request=request)

        with httpx.Client(base_url="http://searxng.test/", transport=httpx.MockTransport(handler)) as client:
            adapter = SearXNGExternalRetrievalAdapter(client)

            with self.assertRaises(ExternalRetrievalUnavailableError):
                adapter.search("query")

    def test_translates_http_failure(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(403, request=request)

        with httpx.Client(base_url="http://searxng.test/", transport=httpx.MockTransport(handler)) as client:
            adapter = SearXNGExternalRetrievalAdapter(client)

            with self.assertRaises(ExternalRetrievalResponseError):
                adapter.search("query")

    def test_rejects_invalid_response(self):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"results": {}})

        with httpx.Client(base_url="http://searxng.test/", transport=httpx.MockTransport(handler)) as client:
            adapter = SearXNGExternalRetrievalAdapter(client)

            with self.assertRaises(ExternalRetrievalResponseError):
                adapter.search("query")


if __name__ == "__main__":
    unittest.main()