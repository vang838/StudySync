from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.orm import Session

from src.application.document_extraction_service import DocumentExtractionService
from src.application.document_normalization_service import DocumentNormalizationService, DocumentNormalizationVersionNotFoundError
from src.application.document_normalizer import DocumentNormalizer
from src.application.document_parser import ExtractedDocument, ExtractedSegment
from src.db.models import DocumentVersionRecord


class TestDocumentNormalizationService(TestCase):
    def setUp(self):
        self.db = Mock(spec=Session)
        self.extraction_service = Mock(spec=DocumentExtractionService)
        self.normalizer = DocumentNormalizer()

        self.version = DocumentVersionRecord(
            version_id="ver123",
            document_id="doc123",
            version_number=1,
            original_filename="notes.txt",
            declared_media_type="text/plain",
            detected_media_type="text/plain",
            file_size_bytes=32,
            file_hash="a" * 64,
            content_hash=None,
            object_key="documents/doc123/versions/ver123/original.txt",
        )

        self.db.get.return_value = self.version

        self.extraction_service.extract.return_value = ExtractedDocument(
            media_type="text/plain",
            segments=[
                ExtractedSegment(
                    text="  Operating   systems\tmanage processes.  ",
                    source_index=1,
                    source_label="text:1",
                )
            ],
        )

        self.service = DocumentNormalizationService(
            db=self.db,
            extraction_service=self.extraction_service,
            normalizer=self.normalizer,
        )

    def test_normalizes_extracted_document(self):
        result = self.service.normalize(version_id="ver123")

        self.assertEqual(result.text, "Operating systems manage processes.")
        self.extraction_service.extract.assert_called_once_with(version_id="ver123")

    def test_persists_content_hash(self):
        result = self.service.normalize(version_id="ver123")

        self.assertEqual(self.version.content_hash, result.content_hash)
        self.db.commit.assert_called_once()

    def test_missing_document_version(self):
        self.db.get.return_value = None

        with self.assertRaises(DocumentNormalizationVersionNotFoundError):
            self.service.normalize(version_id="missing")

        self.extraction_service.extract.assert_not_called()
        self.db.commit.assert_not_called()