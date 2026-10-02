from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from src.adapters.vector_store.pinecone import PineconeVectorStoreAdapter
from src.ports.vector_store import VectorRecord


class TestPineconeVectorStoreAdapter(TestCase):
    def setUp(self):
        self.index = Mock()

        self.adapter = PineconeVectorStoreAdapter(
            index=self.index,
            namespace="documents",
            batch_size=2,
        )

    def test_upserts_vector_records(self):
        self.index.documents.upsert.return_value = SimpleNamespace(
            upserted_count=2
        )

        records = [
            VectorRecord(
                record_id="chunk1",
                vector=[0.1, 0.2, 0.3],
                metadata={
                    "document_id": "doc1",
                    "course_id": "cs101",
                    "chunk_index": 0,
                },
            ),
            VectorRecord(
                record_id="chunk2",
                vector=[0.4, 0.5, 0.6],
                metadata={
                    "document_id": "doc1",
                    "course_id": "cs101",
                    "chunk_index": 1,
                },
            ),
        ]

        result = self.adapter.upsert(records)

        self.assertEqual(result, 2)

        self.index.documents.upsert.assert_called_once_with(
            namespace="documents",
            documents=[
                {
                    "_id": "chunk1",
                    "embedding": [0.1, 0.2, 0.3],
                    "document_id": "doc1",
                    "course_id": "cs101",
                    "chunk_index": 0,
                },
                {
                    "_id": "chunk2",
                    "embedding": [0.4, 0.5, 0.6],
                    "document_id": "doc1",
                    "course_id": "cs101",
                    "chunk_index": 1,
                },
            ],
        )

    def test_empty_records(self):
        result = self.adapter.upsert([])

        self.assertEqual(result, 0)
        self.index.documents.upsert.assert_not_called()

    def test_batches_records(self):
        self.index.documents.upsert.side_effect = [
            SimpleNamespace(upserted_count=2),
            SimpleNamespace(upserted_count=1),
        ]

        records = [
            VectorRecord(
                record_id=f"chunk{i}",
                vector=[float(i)],
                metadata={"chunk_index": i},
            )
            for i in range(3)
        ]

        result = self.adapter.upsert(records)

        self.assertEqual(result, 3)
        self.assertEqual(
            self.index.documents.upsert.call_count,
            2,
        )
    
    def test_searches_by_dense_vector(self):
        self.index.documents.search.return_value = SimpleNamespace(
            matches=[
                SimpleNamespace(
                    id="chunk1",
                    score=0.91,
                    get=lambda field: {
                        "document_id": "doc1",
                        "version_id": "ver1",
                        "chunk_id": "chunk1",
                        "course_id": "cs101",
                        "chunk_index": 0.0,
                        "source_start_label": "text:1",
                        "source_end_label": "text:1",
                    }.get(field),
                )
            ]
        )

        results = self.adapter.search(
            query_vector=[0.1, 0.2, 0.3],
            top_k=5,
            metadata_filter={
                "course_id": {"$eq": "cs101"}
            },
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].record_id, "chunk1")
        self.assertEqual(results[0].score, 0.91)
        self.assertEqual(
            results[0].metadata["course_id"],
            "cs101",
        )
        self.assertEqual(
            results[0].metadata["chunk_index"],
            0,
        )

        kwargs = self.index.documents.search.call_args.kwargs

        self.assertEqual(
            kwargs["namespace"],
            "documents",
        )
        self.assertEqual(
            kwargs["top_k"],
            5,
        )
        self.assertEqual(
            kwargs["filter"],
            {"course_id": {"$eq": "cs101"}},
        )

        dense_query = kwargs["score_by"][0]

        self.assertEqual(
            dense_query.field,
            "embedding",
        )
        self.assertEqual(
            dense_query.values,
            [0.1, 0.2, 0.3],
        )