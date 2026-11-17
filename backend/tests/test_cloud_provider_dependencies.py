
import unittest
from unittest.mock import patch

from src.api import dependencies
from src.adapters.embedding.cloudflare import CloudflareEmbeddingAdapter
from src.adapters.embedding.ollama import OllamaEmbeddingAdapter
from src.adapters.llm.ollama import OllamaAdapter
from src.adapters.llm.openai_compatible import OpenAICompatibleAdapter


class TestCloudProviderDependencies(unittest.TestCase):
    @staticmethod
    def resolve(factory):
        dependency = factory()
        try:
            return next(dependency)
        finally:
            dependency.close()

    def test_selects_openai_compatible_llm(self):
        with (
            patch.object(dependencies.settings, "ai_provider", "openai_compatible"),
            patch.object(dependencies.settings, "ai_api_key", "test-key"),
            patch.object(dependencies.settings, "ai_base_url", "https://example.test/v1"),
            patch("src.api.dependencies.httpx.Client") as client_class,
        ):
            adapter = self.resolve(dependencies.get_llm_port)

            self.assertIsInstance(adapter, OpenAICompatibleAdapter)
            client_class.assert_called_once_with(
                base_url="https://example.test/v1/",
                headers={"Authorization": "Bearer test-key"},
                timeout=dependencies.settings.ai_timeout,
            )

    def test_selects_cloudflare_embeddings(self):
        with (
            patch.object(dependencies.settings, "embedding_provider", "cloudflare"),
            patch.object(dependencies.settings, "embedding_api_key", "test-key"),
            patch.object(dependencies.settings, "embedding_base_url", "https://example.test/ai/run"),
            patch("src.api.dependencies.httpx.Client") as client_class,
        ):
            adapter = self.resolve(dependencies.get_embedding_port)

            self.assertIsInstance(adapter, CloudflareEmbeddingAdapter)
            client_class.assert_called_once_with(
                base_url="https://example.test/ai/run/",
                headers={"Authorization": "Bearer test-key"},
                timeout=dependencies.settings.embedding_timeout,
            )

    def test_ollama_llm_remains_supported(self):
        with (
            patch.object(dependencies.settings, "ai_provider", "ollama"),
            patch("src.api.dependencies.Client") as client_class,
        ):
            adapter = self.resolve(dependencies.get_llm_port)

            self.assertIsInstance(adapter, OllamaAdapter)
            client_class.assert_called_once()

    def test_ollama_embeddings_remain_supported(self):
        with (
            patch.object(dependencies.settings, "embedding_provider", "ollama"),
            patch("src.api.dependencies.Client") as client_class,
        ):
            adapter = self.resolve(dependencies.get_embedding_port)

            self.assertIsInstance(adapter, OllamaEmbeddingAdapter)
            client_class.assert_called_once()

    def test_llm_requires_api_key(self):
        with (
            patch.object(dependencies.settings, "ai_provider", "openai_compatible"),
            patch.object(dependencies.settings, "ai_api_key", ""),
        ):
            with self.assertRaisesRegex(RuntimeError, "AI_API_KEY"):
                self.resolve(dependencies.get_llm_port)

    def test_embeddings_require_api_key(self):
        with (
            patch.object(dependencies.settings, "embedding_provider", "cloudflare"),
            patch.object(dependencies.settings, "embedding_api_key", ""),
        ):
            with self.assertRaisesRegex(RuntimeError, "EMBEDDING_API_KEY"):
                self.resolve(dependencies.get_embedding_port)

    def test_hosted_llm_requires_https(self):
        with (
            patch.object(dependencies.settings, "ai_provider", "openai_compatible"),
            patch.object(dependencies.settings, "ai_api_key", "test-key"),
            patch.object(dependencies.settings, "ai_base_url", "http://example.test/v1"),
        ):
            with self.assertRaisesRegex(RuntimeError, "HTTPS"):
                self.resolve(dependencies.get_llm_port)

    def test_cloudflare_requires_https(self):
        with (
            patch.object(dependencies.settings, "embedding_provider", "cloudflare"),
            patch.object(dependencies.settings, "embedding_api_key", "test-key"),
            patch.object(dependencies.settings, "embedding_base_url", "http://example.test/ai/run"),
        ):
            with self.assertRaisesRegex(RuntimeError, "HTTPS"):
                self.resolve(dependencies.get_embedding_port)

    def test_unsupported_llm_provider(self):
        with patch.object(dependencies.settings, "ai_provider", "unsupported"):
            with self.assertRaisesRegex(RuntimeError, "Unsupported AI provider"):
                self.resolve(dependencies.get_llm_port)

    def test_unsupported_embedding_provider(self):
        with patch.object(dependencies.settings, "embedding_provider", "unsupported"):
            with self.assertRaisesRegex(RuntimeError, "Unsupported embedding provider"):
                self.resolve(dependencies.get_embedding_port)
