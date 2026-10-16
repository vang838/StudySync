from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.orm import Session

from src.application.document_chunker import DocumentChunker
from src.application.document_chunker_service import DocumentChunkingService, IngestionJobNotFoundError
from src.application.document_normalization_service import DocumentNormalizationService
from src.application.document_normalizer import NormalizedDocument, NormalizedSegment
from src.db.models import DocumentChunkRecord, IngestionJobRecord


class TestDocumentChunkingService(TestCase):
    def setUp(self):
        self.db = Mock(spec=Session)
        self.normalization_service = Mock(spec=DocumentNormalizationService)
        self.chunker = DocumentChunker(max_words=5, overlap_words=1)

        self.job = IngestionJobRecord(
            job_id="job123",
            version_id="ver123",
            status="queued",
            current_stage="uploaded",
            pipeline_version="1",
        )

        self.db.get.return_value = self.job

        self.normalization_service.normalize.return_value = NormalizedDocument(
            media_type="application/pdf",
            segments=[
                NormalizedSegment(
                    text="one two three four five six",
                    source_index=4,
                    source_label="page:4",
                )
            ],
            text="one two three four five six",
            content_hash="a" * 64,
        )

        self.service = DocumentChunkingService(
            db=self.db,
            normalization_service=self.normalization_service,
            chunker=self.chunker,
        )

    def test_persists_generated_chunks(self):
        records = self.service.process(job_id="job123")

        self.assertEqual(len(records), 2)
        self.assertIsInstance(records[0], DocumentChunkRecord)
        self.assertEqual(records[0].chunk_index, 0)
        self.assertEqual(records[0].text, "one two three four five")
        self.assertEqual(records[0].page_start, 4)
        self.assertEqual(records[0].page_end, 4)
        self.assertEqual(records[0].source_start_label, "page:4")

        self.db.add_all.assert_called_once()
        self.db.commit.assert_called_once()

    def test_updates_ingestion_job_stage(self):
        self.service.process(job_id="job123")

        self.assertEqual(self.job.status, "processing")
        self.assertEqual(self.job.current_stage, "chunked")

    def test_missing_ingestion_job(self):
        self.db.get.return_value = None

        with self.assertRaises(IngestionJobNotFoundError):
            self.service.process(job_id="missing")

        self.normalization_service.normalize.assert_not_called()
        self.db.commit.assert_not_called()

    def test_non_page_source_does_not_populate_page_fields(self):
        self.normalization_service.normalize.return_value = NormalizedDocument(
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            segments=[
                NormalizedSegment(
                    text="CPU scheduling concepts",
                    source_index=3,
                    source_label="slide:3",
                )
            ],
            text="CPU scheduling concepts",
            content_hash="b" * 64,
        )

        records = self.service.process(job_id="job123")

        self.assertIsNone(records[0].page_start)
        self.assertIsNone(records[0].page_end)
        self.assertEqual(records[0].source_start_index, 3)
        self.assertEqual(records[0].source_start_label, "slide:3")