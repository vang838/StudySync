from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.orm import Session

from src.application.document_retrieval_service import (
    DocumentRetrievalError,
    DocumentRetrievalService,
)
from src.db.models import DocumentChunkRecord
from src.ports.embedding import EmbeddingPort
from src.ports.vector_store import (
    VectorSearchResult,
    VectorStorePort,
)


class TestDocumentRetrievalService(TestCase):
    def setUp(self):
        self.db = Mock(spec=Session)
        self.embedding_port = Mock(spec=EmbeddingPort)
        self.vector_store = Mock(spec=VectorStorePort)

        self.service = DocumentRetrievalService(
            db=self.db,
            embedding_port=self.embedding_port,
            vector_store=self.vector_store,
        )

    def test_retrieves_ranked_chunks(self):
        self.embedding_port.embed_query.return_value = [
            0.1,
            0.2,
            0.3,
        ]

        self.vector_store.search.return_value = [
            VectorSearchResult(
                record_id="chunk2",
                score=0.92,
                metadata={
                    "course_id": "cs101",
                    "chunk_index": 1,
                },
            ),
            VectorSearchResult(
                record_id="chunk1",
                score=0.84,
                metadata={
                    "course_id": "cs101",
                    "chunk_index": 0,
                },
            ),
        ]

        chunk1 = DocumentChunkRecord(
            chunk_id="chunk1",
            job_id="job1",
            chunk_index=0,
            text="TCP provides reliable delivery.",
        )

        chunk2 = DocumentChunkRecord(
            chunk_id="chunk2",
            job_id="job1",
            chunk_index=1,
            text="UDP does not guarantee delivery.",
        )

        self.db.scalars.return_value = [
            chunk1,
            chunk2,
        ]

        results = self.service.retrieve(
            query="Which protocol provides reliable delivery?",
            course_id="cs101",
            top_k=5,
        )

        self.embedding_port.embed_query.assert_called_once_with(
            "Which protocol provides reliable delivery?"
        )

        self.vector_store.search.assert_called_once_with(
            query_vector=[0.1, 0.2, 0.3],
            top_k=5,
            metadata_filter={
                "course_id": {
                    "$eq": "cs101",
                }
            },
        )

        self.assertEqual(len(results), 2)

        self.assertEqual(
            results[0].chunk_id,
            "chunk2",
        )
        self.assertEqual(
            results[0].score,
            0.92,
        )

        self.assertEqual(
            results[1].chunk_id,
            "chunk1",
        )
        self.assertEqual(
            results[1].score,
            0.84,
        )

    def test_returns_empty_when_no_matches(self):
        self.embedding_port.embed_query.return_value = [
            0.1,
            0.2,
            0.3,
        ]

        self.vector_store.search.return_value = []

        results = self.service.retrieve(
            query="What is virtual memory?",
            course_id="cs101",
        )

        self.assertEqual(results, [])
        self.db.scalars.assert_not_called()

    def test_rejects_empty_query(self):
        with self.assertRaises(DocumentRetrievalError):
            self.service.retrieve(
                query="   ",
                course_id="cs101",
            )

        self.embedding_port.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_rejects_invalid_top_k(self):
        with self.assertRaises(DocumentRetrievalError):
            self.service.retrieve(
                query="What is TCP?",
                course_id="cs101",
                top_k=0,
            )

        self.embedding_port.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()