from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

import httpx
from ollama import Client, ResponseError

from src.adapters.embedding.ollama import OllamaEmbeddingAdapter
from src.ports.embedding import (
    EmbeddingResponseError,
    EmbeddingUnavailableError,
)


class TestOllamaEmbeddingAdapter(TestCase):
    def setUp(self):
        self.client = Mock(spec=Client)

        self.adapter = OllamaEmbeddingAdapter(
            client=self.client,
            model="qwen3-embedding:0.6b",
            dimension=3,
        )

    def test_successful_batch_embedding(self):
        self.client.embed.return_value = SimpleNamespace(
            embeddings=[
                [0.1, 0.2, 0.3],
                [0.4, 0.5, 0.6],
            ]
        )

        result = self.adapter.embed(
            [
                "TCP provides reliable delivery.",
                "UDP is connectionless.",
            ]
        )

        self.assertEqual(
            result,
            [
                [0.1, 0.2, 0.3],
                [0.4, 0.5, 0.6],
            ],
        )

        self.client.embed.assert_called_once_with(
            model="qwen3-embedding:0.6b",
            input=[
                "TCP provides reliable delivery.",
                "UDP is connectionless.",
            ],
        )

    def test_empty_input(self):
        result = self.adapter.embed([])

        self.assertEqual(result, [])
        self.client.embed.assert_not_called()

    def test_connection_failure(self):
        self.client.embed.side_effect = httpx.ConnectError(
            "Connection refused"
        )

        with self.assertRaises(EmbeddingUnavailableError):
            self.adapter.embed(["Hello"])

    def test_ollama_error(self):
        self.client.embed.side_effect = ResponseError(
            "Model not found",
            status_code=404,
        )

        with self.assertRaises(EmbeddingResponseError):
            self.adapter.embed(["Hello"])

    def test_unexpected_embedding_count(self):
        self.client.embed.return_value = SimpleNamespace(
            embeddings=[
                [0.1, 0.2, 0.3],
            ]
        )

        with self.assertRaises(EmbeddingResponseError):
            self.adapter.embed(
                [
                    "First text",
                    "Second text",
                ]
            )

    def test_unexpected_embedding_dimension(self):
        self.client.embed.return_value = SimpleNamespace(
            embeddings=[
                [0.1, 0.2],
            ]
        )

        with self.assertRaises(EmbeddingResponseError):
            self.adapter.embed(["Hello"])
    
    def test_query_embedding_uses_instruction(self):
        self.client.embed.return_value = SimpleNamespace(
            embeddings=[
                [0.1, 0.2, 0.3],
            ]
        )

        result = self.adapter.embed_query(
            "Which protocol guarantees delivery?"
        )

        self.assertEqual(
            result,
            [0.1, 0.2, 0.3],
        )

        self.client.embed.assert_called_once_with(
            model="qwen3-embedding:0.6b",
            input=[
                "Instruct: Given a student question, retrieve relevant "
                "passages from course materials that answer the question\n"
                "Query:Which protocol guarantees delivery?"
            ],
        )
    
    def test_query_embedding_rejects_empty_query(self):
        with self.assertRaises(EmbeddingResponseError):
            self.adapter.embed_query("   ")

        self.client.embed.assert_not_called()