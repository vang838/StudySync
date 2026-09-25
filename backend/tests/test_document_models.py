from unittest import TestCase

from src.db.models import (
    DocumentChunkRecord,
    DocumentRecord,
    DocumentVersionRecord,
    IngestionJobRecord,
)


class TestDocumentModels(TestCase):
    def test_document_model_tables(self):
        self.assertEqual(DocumentRecord.__tablename__, "documents")
        self.assertEqual(DocumentVersionRecord.__tablename__, "document_versions")
        self.assertEqual(IngestionJobRecord.__tablename__, "ingestion_jobs")
        self.assertEqual(DocumentChunkRecord.__tablename__, "document_chunks")

    def test_document_version_metadata_columns(self):
        columns = DocumentVersionRecord.__table__.columns

        self.assertIn("version_id", columns)
        self.assertIn("document_id", columns)
        self.assertIn("version_number", columns)
        self.assertIn("original_filename", columns)
        self.assertIn("declared_media_type", columns)
        self.assertIn("detected_media_type", columns)
        self.assertIn("file_size_bytes", columns)
        self.assertIn("file_hash", columns)
        self.assertIn("content_hash", columns)
        self.assertIn("object_key", columns)

    def test_ingestion_job_tracking_columns(self):
        columns = IngestionJobRecord.__table__.columns

        self.assertIn("job_id", columns)
        self.assertIn("version_id", columns)
        self.assertIn("status", columns)
        self.assertIn("current_stage", columns)
        self.assertIn("pipeline_version", columns)
        self.assertIn("retry_count", columns)
        self.assertIn("failure_code", columns)
        self.assertIn("failure_message", columns)

    def test_chunk_provenance_columns(self):
        columns = DocumentChunkRecord.__table__.columns

        self.assertIn("chunk_id", columns)
        self.assertIn("job_id", columns)
        self.assertIn("chunk_index", columns)
        self.assertIn("text", columns)
        self.assertIn("page_start", columns)
        self.assertIn("page_end", columns)
        self.assertIn("section_title", columns)
        self.assertIn("token_count", columns)
        self.assertIn("source_start_index", columns)
        self.assertIn("source_end_index", columns)
        self.assertIn("source_start_label", columns)
        self.assertIn("source_end_label", columns)