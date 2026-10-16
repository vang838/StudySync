from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.orm import Session

from src.application.document_embedding_service import (
    DocumentEmbeddingService,
    EmbeddedChunk,
    EmbeddingChunksNotFoundError,
    EmbeddingJobNotFoundError,
)
from src.db.models import DocumentChunkRecord, IngestionJobRecord
from src.ports.embedding import EmbeddingPort


class TestDocumentEmbeddingService(TestCase):
    def setUp(self):
        self.db = Mock(spec=Session)
        self.embedding_port = Mock(spec=EmbeddingPort)

        self.job = IngestionJobRecord(
            job_id="job123",
            version_id="ver123",
            status="processing",
            current_stage="chunked",
            pipeline_version="1",
        )

        self.chunks = [
            DocumentChunkRecord(
                chunk_id="chunk0",
                job_id="job123",
                chunk_index=0,
                text="TCP provides reliable delivery.",
            ),
            DocumentChunkRecord(
                chunk_id="chunk1",
                job_id="job123",
                chunk_index=1,
                text="UDP is connectionless.",
            ),
            DocumentChunkRecord(
                chunk_id="chunk2",
                job_id="job123",
                chunk_index=2,
                text="Virtual memory uses pages.",
            ),
        ]

        self.db.get.return_value = self.job
        self.db.scalars.return_value = self.chunks

        self.service = DocumentEmbeddingService(
            db=self.db,
            embedding_port=self.embedding_port,
            batch_size=2,
        )

    def test_embeds_persisted_chunks(self):
        self.embedding_port.embed.side_effect = [
            [
                [0.1, 0.2],
                [0.3, 0.4],
            ],
            [
                [0.5, 0.6],
            ],
        ]

        result = self.service.embed_job(job_id="job123")

        self.assertEqual(len(result), 3)
        self.assertIsInstance(result[0], EmbeddedChunk)

        self.assertEqual(result[0].chunk_id, "chunk0")
        self.assertEqual(result[0].chunk_index, 0)
        self.assertEqual(result[0].vector, [0.1, 0.2])

        self.assertEqual(result[1].chunk_id, "chunk1")
        self.assertEqual(result[2].chunk_id, "chunk2")

    def test_batches_chunk_text(self):
        self.embedding_port.embed.side_effect = [
            [
                [0.1, 0.2],
                [0.3, 0.4],
            ],
            [
                [0.5, 0.6],
            ],
        ]

        self.service.embed_job(job_id="job123")

        self.assertEqual(
            self.embedding_port.embed.call_args_list[0].args[0],
            [
                "TCP provides reliable delivery.",
                "UDP is connectionless.",
            ],
        )

        self.assertEqual(
            self.embedding_port.embed.call_args_list[1].args[0],
            [
                "Virtual memory uses pages.",
            ],
        )

        self.assertEqual(self.embedding_port.embed.call_count, 2)

    def test_preserves_chunk_order(self):
        self.embedding_port.embed.side_effect = [
            [
                [0.1],
                [0.2],
            ],
            [
                [0.3],
            ],
        ]

        result = self.service.embed_job(job_id="job123")

        self.assertEqual(
            [chunk.chunk_index for chunk in result],
            [0, 1, 2],
        )

    def test_missing_ingestion_job(self):
        self.db.get.return_value = None

        with self.assertRaises(EmbeddingJobNotFoundError):
            self.service.embed_job(job_id="missing")

        self.db.scalars.assert_not_called()
        self.embedding_port.embed.assert_not_called()

    def test_no_document_chunks(self):
        self.db.scalars.return_value = []

        with self.assertRaises(EmbeddingChunksNotFoundError):
            self.service.embed_job(job_id="job123")

        self.embedding_port.embed.assert_not_called()