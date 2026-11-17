
import json
import unittest

import httpx

from src.adapters.embedding.cloudflare import CloudflareEmbeddingAdapter
from src.ports.embedding import EmbeddingResponseError, EmbeddingUnavailableError


class TestCloudflareEmbeddingAdapter(unittest.TestCase):
    def make_adapter(self, handler):
        client = httpx.Client(
            base_url="https://api.cloudflare.com/client/v4/accounts/test-account/ai/run/",
            headers={"Authorization": "Bearer test-key"},
            transport=httpx.MockTransport(handler),
        )
        self.addCleanup(client.close)
        return CloudflareEmbeddingAdapter(client=client, model="@cf/qwen/qwen3-embedding-0.6b", dimension=3)

    def test_document_embeddings(self):
        vectors = [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]

        def handler(request):
            self.assertEqual(request.method, "POST")
            self.assertEqual(
                request.url.path,
                "/client/v4/accounts/test-account/ai/run/@cf/qwen/qwen3-embedding-0.6b",
            )
            self.assertEqual(request.headers["authorization"], "Bearer test-key")
            self.assertEqual(json.loads(request.content), {"documents": ["Lecture 1", "Lecture 2"]})
            return httpx.Response(200, json={"success": True, "result": {"data": vectors, "shape": [2, 3]}})

        adapter = self.make_adapter(handler)
        self.assertEqual(adapter.embed(["Lecture 1", "Lecture 2"]), vectors)

    def test_query_embedding(self):
        def handler(request):
            payload = json.loads(request.content)
            self.assertEqual(payload["queries"], ["Explain operating systems"])
            self.assertEqual(
                payload["instruction"],
                "Given a student question, retrieve relevant course passages that answer the question.",
            )
            return httpx.Response(200, json={"success": True, "result": {"data": [[0.1, 0.2, 0.3]]}})

        adapter = self.make_adapter(handler)
        self.assertEqual(adapter.embed_query("Explain operating systems"), [0.1, 0.2, 0.3])

    def test_empty_documents(self):
        def handler(request):
            self.fail("An empty document list must not produce an API request")

        adapter = self.make_adapter(handler)
        self.assertEqual(adapter.embed([]), [])

    def test_authentication_failure(self):
        adapter = self.make_adapter(lambda request: httpx.Response(401))
        with self.assertRaises(EmbeddingResponseError):
            adapter.embed(["Test"])

    def test_invalid_request(self):
        adapter = self.make_adapter(lambda request: httpx.Response(400))
        with self.assertRaises(EmbeddingResponseError):
            adapter.embed(["Test"])

    def test_rate_limit(self):
        adapter = self.make_adapter(lambda request: httpx.Response(429))
        with self.assertRaises(EmbeddingUnavailableError):
            adapter.embed(["Test"])

    def test_server_failure(self):
        adapter = self.make_adapter(lambda request: httpx.Response(503))
        with self.assertRaises(EmbeddingUnavailableError):
            adapter.embed(["Test"])

    def test_timeout(self):
        def handler(request):
            raise httpx.ConnectTimeout("Connection timed out", request=request)

        adapter = self.make_adapter(handler)
        with self.assertRaises(EmbeddingUnavailableError):
            adapter.embed(["Test"])

    def test_invalid_json(self):
        adapter = self.make_adapter(lambda request: httpx.Response(200, content="not-json"))
        with self.assertRaises(EmbeddingResponseError):
            adapter.embed(["Test"])

    def test_missing_result(self):
        adapter = self.make_adapter(lambda request: httpx.Response(200, json={"success": True}))
        with self.assertRaises(EmbeddingResponseError):
            adapter.embed(["Test"])

    def test_wrong_vector_count(self):
        adapter = self.make_adapter(
            lambda request: httpx.Response(200, json={"result": {"data": [[0.1, 0.2, 0.3]]}})
        )
        with self.assertRaises(EmbeddingResponseError):
            adapter.embed(["Document 1", "Document 2"])

    def test_wrong_vector_dimension(self):
        adapter = self.make_adapter(
            lambda request: httpx.Response(200, json={"result": {"data": [[0.1, 0.2]]}})
        )
        with self.assertRaises(EmbeddingResponseError):
            adapter.embed(["Test"])

    def test_invalid_vector_values(self):
        invalid_vectors = [
            [0.1, "invalid", 0.3],
            [0.1, True, 0.3],
            [0.1, float("nan"), 0.3],
            [0.1, float("inf"), 0.3],
        ]

        for vector in invalid_vectors:
            with self.subTest(vector=vector):
                body = json.dumps({"result": {"data": [vector]}}, allow_nan=True)
                adapter = self.make_adapter(
                    lambda request: httpx.Response(
                        200, content=body, headers={"content-type": "application/json"}
                    )
                )
                with self.assertRaises(EmbeddingResponseError):
                    adapter.embed(["Test"])
