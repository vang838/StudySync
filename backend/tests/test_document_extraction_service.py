from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.orm import Session

from src.application.document_extraction_service import DocumentExtractionService, DocumentVersionNotFoundError
from src.application.document_parser import DocumentParserRegistry, ExtractedDocument, ExtractedSegment
from src.db.models import DocumentVersionRecord


class FakeObjectStorage:
    def __init__(self, content: bytes):
        self.content = content
        self.downloaded_key: str | None = None

    def upload(self, *, key: str, fileobj, content_type: str | None = None) -> None:
        raise NotImplementedError

    def download(self, *, key: str, fileobj) -> None:
        self.downloaded_key = key
        fileobj.write(self.content)

    def delete(self, *, key: str) -> None:
        raise NotImplementedError


class TestDocumentExtractionService(TestCase):
    def setUp(self):
        self.db = Mock(spec=Session)
        self.storage = FakeObjectStorage(b"Operating systems manage processes.")
        self.registry = Mock(spec=DocumentParserRegistry)
        self.parser = Mock()

        self.version = DocumentVersionRecord(
            version_id="ver123",
            document_id="doc123",
            version_number=1,
            original_filename="notes.txt",
            declared_media_type="text/plain",
            detected_media_type="text/plain",
            file_size_bytes=35,
            file_hash="a" * 64,
            content_hash=None,
            object_key="documents/doc123/versions/ver123/original.txt",
        )

        self.db.get.return_value = self.version
        self.registry.get.return_value = self.parser
        self.parser.parse.return_value = ExtractedDocument(
            media_type="text/plain",
            segments=[
                ExtractedSegment(
                    text="Operating systems manage processes.",
                    source_index=1,
                    source_label="text:1",
                )
            ],
        )

        self.service = DocumentExtractionService(
            db=self.db,
            storage=self.storage,
            parser_registry=self.registry,
        )

    def test_extracts_stored_document(self):
        result = self.service.extract(version_id="ver123")

        self.db.get.assert_called_once_with(DocumentVersionRecord, "ver123")
        self.assertEqual(self.storage.downloaded_key, self.version.object_key)
        self.registry.get.assert_called_once_with("text/plain")
        self.parser.parse.assert_called_once()

        self.assertEqual(result.media_type, "text/plain")
        self.assertEqual(result.segments[0].text, "Operating systems manage processes.")

    def test_missing_document_version(self):
        self.db.get.return_value = None

        with self.assertRaises(DocumentVersionNotFoundError):
            self.service.extract(version_id="missing")

        self.registry.get.assert_not_called()

    def test_uses_detected_media_type(self):
        self.service.extract(version_id="ver123")

        self.registry.get.assert_called_once_with(self.version.detected_media_type)

    def test_extracts_with_real_parser_registry(self):
        storage = FakeObjectStorage(b"Operating systems manage processes.")
        registry = DocumentParserRegistry()
        service = DocumentExtractionService(db=self.db, storage=storage, parser_registry=registry)

        result = service.extract(version_id="ver123")

        self.assertEqual(result.media_type, "text/plain")
        self.assertEqual(len(result.segments), 1)
        self.assertEqual(result.segments[0].text, "Operating systems manage processes.")
        self.assertEqual(result.segments[0].source_label, "text:1")