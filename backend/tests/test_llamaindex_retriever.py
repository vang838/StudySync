from unittest import TestCase
from unittest.mock import Mock

from llama_index.core import QueryBundle

from src.adapters.retrieval.llamaindex import LlamaIndexDocumentRetriever
from src.application.document_retrieval_service import (
    DocumentRetrievalService,
    RetrievedChunk,
)


class TestLlamaIndexDocumentRetriever(TestCase):
    def setUp(self) -> None:
        self.retrieval_service = Mock(spec=DocumentRetrievalService)

        self.retriever = LlamaIndexDocumentRetriever(
            retrieval_service=self.retrieval_service,
            course_id="course-123",
            top_k=3,
        )

    def test_retrieve_converts_chunks_to_llamaindex_nodes(self) -> None:
        self.retrieval_service.retrieve.return_value = [
            RetrievedChunk(
                chunk_id="chunk-1",
                text="Retrieval augmented generation uses retrieved context.",
                score=0.91,
                metadata={
                    "document_id": "doc-1",
                    "course_id": "course-123",
                    "chunk_index": 0,
                },
            ),
            RetrievedChunk(
                chunk_id="chunk-2",
                text="The retrieved context is supplied to the language model.",
                score=0.84,
                metadata={
                    "document_id": "doc-2",
                    "course_id": "course-123",
                    "chunk_index": 2,
                },
            ),
        ]

        results = self.retriever.retrieve(
            QueryBundle(query_str="How does RAG work?")
        )

        self.retrieval_service.retrieve.assert_called_once_with(
            query="How does RAG work?",
            course_id="course-123",
            document_ids=None,
            top_k=3,
        )

        self.assertEqual(len(results), 2)

        self.assertEqual(results[0].node.node_id, "chunk-1")
        self.assertEqual(
            results[0].node.text,
            "Retrieval augmented generation uses retrieved context.",
        )
        self.assertEqual(results[0].score, 0.91)
        self.assertEqual(results[0].node.metadata["document_id"], "doc-1")
        self.assertEqual(results[0].node.metadata["course_id"], "course-123")

        self.assertEqual(results[1].node.node_id, "chunk-2")
        self.assertEqual(results[1].score, 0.84)

    def test_retrieve_returns_empty_list_when_no_chunks_found(self) -> None:
        self.retrieval_service.retrieve.return_value = []

        results = self.retriever.retrieve(
            QueryBundle(query_str="What is vector search?")
        )

        self.assertEqual(results, [])

    def test_course_id_must_not_be_empty(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "course_id must not be empty",
        ):
            LlamaIndexDocumentRetriever(
                retrieval_service=self.retrieval_service,
                course_id="   ",
            )

    def test_top_k_must_be_greater_than_zero(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "top_k must be greater than zero",
        ):
            LlamaIndexDocumentRetriever(
                retrieval_service=self.retrieval_service,
                course_id="course-123",
                top_k=0,
            )
    
    def test_retriever_forwards_document_ids(self) -> None:
        retriever = LlamaIndexDocumentRetriever(
            retrieval_service=self.retrieval_service,
            course_id="course-123",
            document_ids=[
                "doc-1",
                "doc-2",
            ],
            top_k=3,
        )

        self.retrieval_service.retrieve.return_value = []

        results = retriever.retrieve(
            QueryBundle(query_str="How does RAG work?")
        )

        self.retrieval_service.retrieve.assert_called_once_with(
            query="How does RAG work?",
            course_id="course-123",
            document_ids=[
                "doc-1",
                "doc-2",
            ],
            top_k=3,
        )

        self.assertEqual(results, [])