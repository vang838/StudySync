from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.orm import Session

from src.application.document_embedding_service import (
    DocumentEmbeddingService,
    EmbeddedChunk,
)
from src.application.document_vector_indexing_service import (
    DocumentVectorIndexingService,
    IndexingJobNotFoundError,
)
from src.db.models import (
    DocumentChunkRecord,
    DocumentRecord,
    DocumentVersionRecord,
    IngestionJobRecord,
)
from src.ports.vector_store import VectorStorePort


class TestDocumentVectorIndexingService(TestCase):
    def setUp(self):
        self.db = Mock(spec=Session)
        self.embedding_service = Mock(
            spec=DocumentEmbeddingService
        )
        self.vector_store = Mock(spec=VectorStorePort)

        self.job = IngestionJobRecord(
            job_id="job123",
            version_id="ver123",
            status="processing",
            current_stage="chunked",
            pipeline_version="1",
        )

        self.version = DocumentVersionRecord(
            version_id="ver123",
            document_id="doc123",
            version_number=1,
            original_filename="test.txt",
            declared_media_type="text/plain",
            detected_media_type="text/plain",
            file_size_bytes=100,
            file_hash="a" * 64,
            content_hash="b" * 64,
            object_key="documents/doc123/test.txt",
        )

        self.document = DocumentRecord(
            document_id="doc123",
            course_id="cs101",
            owner_ref=None,
            title="Test Document",
        )

        self.chunk = DocumentChunkRecord(
            chunk_id="chunk123",
            job_id="job123",
            chunk_index=0,
            text="TCP provides reliable delivery.",
            source_start_index=1,
            source_end_index=1,
            source_start_label="text:1",
            source_end_label="text:1",
        )

        self.db.get.side_effect = [
            self.job,
            self.version,
            self.document,
        ]

        self.db.scalars.return_value = [self.chunk]

        self.embedding_service.embed_job.return_value = [
            EmbeddedChunk(
                chunk_id="chunk123",
                chunk_index=0,
                vector=[0.1, 0.2, 0.3],
            )
        ]

        self.vector_store.upsert.return_value = 1

        self.service = DocumentVectorIndexingService(
            db=self.db,
            embedding_service=self.embedding_service,
            vector_store=self.vector_store,
        )

    def test_indexes_document_chunks(self):
        result = self.service.index_job(job_id="job123")

        self.assertEqual(result, 1)

        records = self.vector_store.upsert.call_args.args[0]

        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].record_id, "chunk123")
        self.assertEqual(
            records[0].vector,
            [0.1, 0.2, 0.3],
        )

        self.assertEqual(
            records[0].metadata["document_id"],
            "doc123",
        )
        self.assertEqual(
            records[0].metadata["course_id"],
            "cs101",
        )
        self.assertEqual(
            records[0].metadata["source_start_label"],
            "text:1",
        )

    def test_marks_job_ready_after_indexing(self):
        self.service.index_job(job_id="job123")

        self.assertEqual(self.job.status, "ready")
        self.assertEqual(self.job.current_stage, "indexed")
        self.db.commit.assert_called_once()

    def test_missing_ingestion_job(self):
        self.db.get.side_effect = None
        self.db.get.return_value = None

        with self.assertRaises(IndexingJobNotFoundError):
            self.service.index_job(job_id="missing")

        self.embedding_service.embed_job.assert_not_called()
        self.vector_store.upsert.assert_not_called()
        self.db.commit.assert_not_called()