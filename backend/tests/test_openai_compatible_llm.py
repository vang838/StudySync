import json
import unittest

import httpx

from src.adapters.llm.openai_compatible import OpenAICompatibleAdapter
from src.ports.llm import LLMResponseError, LLMUnavailableError


class TestOpenAICompatibleAdapter(unittest.TestCase):
    def make_adapter(self, handler):
        client = httpx.Client(
            base_url="https://example.test/v1/",
            headers={"Authorization": "Bearer test-key"},
            transport=httpx.MockTransport(handler),
        )
        self.addCleanup(client.close)
        return OpenAICompatibleAdapter(client=client, model="openai/gpt-oss-120b")

    def test_successful_generation(self):
        def handler(request):
            self.assertEqual(request.method, "POST")
            self.assertEqual(request.url.path, "/v1/chat/completions")
            self.assertEqual(request.headers["authorization"], "Bearer test-key")

            payload = json.loads(request.content)
            self.assertEqual(payload["model"], "openai/gpt-oss-120b")
            self.assertEqual(payload["messages"], [{"role": "user", "content": "Explain RAG"}])

            return httpx.Response(200, json={
                "choices": [{"message": {"role": "assistant", "content": "RAG retrieves supporting evidence."}}]
            })

        adapter = self.make_adapter(handler)
        self.assertEqual(adapter.generate("Explain RAG"), "RAG retrieves supporting evidence.")

    def test_authentication_failure(self):
        adapter = self.make_adapter(lambda request: httpx.Response(401))
        with self.assertRaises(LLMResponseError):
            adapter.generate("Test")

    def test_rate_limit(self):
        adapter = self.make_adapter(lambda request: httpx.Response(429))
        with self.assertRaises(LLMUnavailableError):
            adapter.generate("Test")

    def test_server_failure(self):
        adapter = self.make_adapter(lambda request: httpx.Response(503))
        with self.assertRaises(LLMUnavailableError):
            adapter.generate("Test")

    def test_timeout(self):
        def handler(request):
            raise httpx.ConnectTimeout("Connection timed out", request=request)

        adapter = self.make_adapter(handler)
        with self.assertRaises(LLMUnavailableError):
            adapter.generate("Test")

    def test_invalid_response(self):
        adapter = self.make_adapter(lambda request: httpx.Response(200, json={"choices": []}))
        with self.assertRaises(LLMResponseError):
            adapter.generate("Test")

    def test_empty_response(self):
        adapter = self.make_adapter(lambda request: httpx.Response(200, json={
            "choices": [{"message": {"content": "   "}}]
        }))
        with self.assertRaises(LLMResponseError):
            adapter.generate("Test")