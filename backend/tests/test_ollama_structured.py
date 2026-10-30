from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from ollama import Client

from src.adapters.llm.ollama import OllamaAdapter


class TestOllamaStructuredGeneration(TestCase):
    def test_passes_response_schema_to_ollama_format(self):
        client = Mock(spec=Client)
        client.chat.return_value = SimpleNamespace(message=SimpleNamespace(content='{"claims": []}'))
        schema = {"type": "object", "properties": {"claims": {"type": "array"}}}
        adapter = OllamaAdapter(client, "qwen3:0.6b")

        result = adapter.generate("Assess these claims.", response_schema=schema)

        self.assertEqual(result, '{"claims": []}')
        client.chat.assert_called_once_with(
            model="qwen3:0.6b", messages=[{"role": "user", "content": "Assess these claims."}],
            stream=False, format=schema, options={"temperature": 0},
        )
