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
        self.db.scalars.return_value = ["doc-1"]
        self.embedding_port.embed_query.return_value = [0.1, 0.2, 0.3]

        self.vector_store.search.return_value = [
            VectorSearchResult(
                record_id="chunk2",
                score=0.92,
                metadata={
                    "course_id": "cs101",
                    "document_id": "doc-1",
                    "version_id": "version-1",
                    "chunk_index": 1,
                },
            ),
            VectorSearchResult(
                record_id="chunk1",
                score=0.84,
                metadata={
                    "course_id": "cs101",
                    "document_id": "doc-1",
                    "version_id": "version-1",
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

        self.db.execute.return_value = [
            (chunk1, "doc-1", "version-1"),
            (chunk2, "doc-1", "version-1"),
        ]

        results = self.service.retrieve(
            query="Which protocol provides reliable delivery?",
            course_id="cs101",
            user_id=1,
            top_k=5,
        )

        self.embedding_port.embed_query.assert_called_once_with(
            "Which protocol provides reliable delivery?"
        )

        self.vector_store.search.assert_called_once_with(
            query_vector=[0.1, 0.2, 0.3],
            top_k=5,
            metadata_filter={
                "$and": [
                    {"course_id": {"$eq": "cs101"}},
                    {"document_id": {"$in": ["doc-1"]}},
                ]
            },
        )

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].chunk_id, "chunk2")
        self.assertEqual(results[0].score, 0.92)
        self.assertEqual(results[1].chunk_id, "chunk1")
        self.assertEqual(results[1].score, 0.84)

    def test_returns_empty_when_no_matches(self):
        self.db.scalars.return_value = ["doc-1"]
        self.embedding_port.embed_query.return_value = [0.1, 0.2, 0.3]
        self.vector_store.search.return_value = []

        results = self.service.retrieve(
            query="What is virtual memory?",
            course_id="cs101",
            user_id=1,
        )

        self.assertEqual(results, [])
        self.db.scalars.assert_called_once()
        self.db.execute.assert_not_called()
        self.vector_store.search.assert_called_once()

    def test_rejects_empty_query(self):
        with self.assertRaises(DocumentRetrievalError):
            self.service.retrieve(
                query="   ",
                course_id="cs101",
                user_id=1,
            )

        self.embedding_port.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_rejects_invalid_top_k(self):
        with self.assertRaises(DocumentRetrievalError):
            self.service.retrieve(
                query="What is TCP?",
                course_id="cs101",
                user_id=1,
                top_k=0,
            )

        self.embedding_port.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_filters_by_course_and_document_ids(self):
        self.db.scalars.return_value = ["doc-1", "doc-2"]
        self.embedding_port.embed_query.return_value = [0.1, 0.2, 0.3]
        self.vector_store.search.return_value = []

        results = self.service.retrieve(
            query="What is TCP?",
            course_id="cs101",
            user_id=1,
            document_ids=[" doc-1 ", "", "doc-2", "doc-1"],
            top_k=5,
        )

        self.embedding_port.embed_query.assert_called_once_with("What is TCP?")

        self.vector_store.search.assert_called_once_with(
            query_vector=[0.1, 0.2, 0.3],
            top_k=5,
            metadata_filter={
                "$and": [
                    {"course_id": {"$eq": "cs101"}},
                    {"document_id": {"$in": ["doc-1", "doc-2"]}},
                ]
            },
        )

        self.assertEqual(results, [])

    def test_rejects_empty_document_ids(self):
        with self.assertRaises(DocumentRetrievalError):
            self.service.retrieve(
                query="What is TCP?",
                course_id="cs101",
                user_id=1,
                document_ids=["", "   "],
            )

        self.embedding_port.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_excludes_chunks_from_other_courses(self):
        self.db.scalars.return_value = ["doc-1"]
        self.embedding_port.embed_query.return_value = [0.1, 0.2, 0.3]

        self.vector_store.search.return_value = [
            VectorSearchResult(
                record_id="chunk1",
                score=0.95,
                metadata={
                    "course_id": "cs101",
                    "document_id": "doc-1",
                    "version_id": "version-1",
                },
            ),
            VectorSearchResult(
                record_id="chunk2",
                score=0.90,
                metadata={
                    "course_id": "cs202",
                    "document_id": "doc-1",
                    "version_id": "version-1",
                },
            ),
        ]

        chunk1 = DocumentChunkRecord(
            chunk_id="chunk1",
            job_id="job1",
            chunk_index=0,
            text="CS101 material",
        )

        chunk2 = DocumentChunkRecord(
            chunk_id="chunk2",
            job_id="job2",
            chunk_index=0,
            text="CS202 material",
        )

        self.db.execute.return_value = [
            (chunk1, "doc-1", "version-1"),
            (chunk2, "doc-1", "version-1"),
        ]

        results = self.service.retrieve(
            query="Explain this concept",
            course_id="cs101",
            user_id=1,
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].chunk_id, "chunk1")
        self.assertEqual(results[0].metadata["course_id"], "cs101")

    def test_unauthorized_documents_are_not_searched(self):
        self.db.scalars.return_value = []

        results = self.service.retrieve(
            query="Explain private lecture notes",
            course_id="cs101",
            user_id=1,
        )

        self.assertEqual(results, [])
        self.embedding_port.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_explicit_selection_rejects_inaccessible_documents(self):
        self.db.scalars.return_value = ["doc-1"]

        results = self.service.retrieve(
            query="Explain the selected documents",
            course_id="cs101",
            user_id=1,
            document_ids=["doc-1", "doc-2"],
        )

        self.assertEqual(results, [])
        self.embedding_port.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_rejects_mismatched_vector_document_metadata(self):
        self.db.scalars.return_value = ["doc-1"]
        self.embedding_port.embed_query.return_value = [0.1, 0.2, 0.3]

        self.vector_store.search.return_value = [
            VectorSearchResult(
                record_id="chunk1",
                score=0.95,
                metadata={
                    "course_id": "cs101",
                    "document_id": "doc-2",
                    "version_id": "version-1",
                },
            ),
        ]

        chunk = DocumentChunkRecord(
            chunk_id="chunk1",
            job_id="job1",
            chunk_index=0,
            text="Private document content",
        )

        self.db.execute.return_value = [(chunk, "doc-1", "version-1")]

        results = self.service.retrieve(
            query="Explain this concept",
            course_id="cs101",
            user_id=1,
        )

        self.assertEqual(results, [])