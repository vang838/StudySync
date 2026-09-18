import unittest
from types import SimpleNamespace
from unittest.mock import Mock

import httpx
from ollama import Client, ResponseError

from src.adapters.llm.ollama import OllamaAdapter
from src.ports.llm import (
    LLMResponseError,
    LLMUnavailableError,
)


class TestOllamaAdapter(unittest.TestCase):

    def setUp(self):
        self.client = Mock(spec=Client)

        self.adapter = OllamaAdapter(
            client=self.client,
            model="qwen3:14b",
        )

    def test_successful_generation(self):
        self.client.chat.return_value = SimpleNamespace(
            message=SimpleNamespace(
                content="Hello from StudySync."
            )
        )

        result = self.adapter.generate("Hello")

        self.assertEqual(
            result,
            "Hello from StudySync.",
        )

        self.client.chat.assert_called_once_with(
            model="qwen3:14b",
            messages=[
                {
                    "role": "user",
                    "content": "Hello",
                }
            ],
            stream=False,
        )

    def test_connection_failure(self):
        self.client.chat.side_effect = httpx.ConnectError(
            "Connection refused"
        )

        with self.assertRaises(LLMUnavailableError):
            self.adapter.generate("Hello")

    def test_ollama_error(self):
        self.client.chat.side_effect = ResponseError(
            "Model not found",
            status_code=404,
        )

        with self.assertRaises(LLMResponseError):
            self.adapter.generate("Hello")

    def test_empty_response(self):
        self.client.chat.return_value = SimpleNamespace(
            message=SimpleNamespace(
                content=""
            )
        )

        with self.assertRaises(LLMResponseError):
            self.adapter.generate("Hello")


if __name__ == "__main__":
    unittest.main()