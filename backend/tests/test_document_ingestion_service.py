from io import BytesIO
from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy.orm import Session

from src.application.document_ingestion_service import DocumentIngestionService, DuplicateDocumentError
from src.application.docs_upload import DocumentUploadInspection, DocumentUploadInspector
from src.db.models import DocumentRecord, DocumentVersionRecord, IngestionJobRecord


class FakeObjectStorage:
    def __init__(self):
        self.uploaded: list[dict] = []
        self.deleted: list[str] = []

    def upload(self, *, key: str, fileobj, content_type: str | None = None) -> None:
        self.uploaded.append(
            {
                "key": key,
                "content": fileobj.read(),
                "content_type": content_type,
            }
        )

    def download(self, *, key: str, fileobj) -> None:
        raise NotImplementedError

    def delete(self, *, key: str) -> None:
        self.deleted.append(key)


class TestDocumentIngestionService(TestCase):
    def setUp(self):
        self.db = Mock(spec=Session)
        self.storage = FakeObjectStorage()
        self.inspector = Mock(spec=DocumentUploadInspector)

        self.inspector.inspect.return_value = DocumentUploadInspection(
            original_filename="lecture.pdf",
            extension=".pdf",
            declared_media_type="application/pdf",
            detected_media_type="application/pdf",
            file_size_bytes=18,
            file_hash="a" * 64,
        )

        self.db.scalar.return_value = None

        self.service = DocumentIngestionService(
            db=self.db,
            storage=self.storage,
            inspector=self.inspector,
        )

    def test_successful_ingestion(self):
        fileobj = BytesIO(b"%PDF-1.7\nStudySync")

        result = self.service.ingest(
            course_id="CS537",
            title="Lecture Notes",
            filename="lecture.pdf",
            declared_media_type="application/pdf",
            fileobj=fileobj,
        )

        self.assertEqual(result.course_id, "CS537")
        self.assertEqual(result.title, "Lecture Notes")
        self.assertEqual(result.status, "queued")

        self.assertEqual(len(self.storage.uploaded), 1)
        self.assertEqual(self.storage.uploaded[0]["content"], b"%PDF-1.7\nStudySync")

        records = self.db.add_all.call_args.args[0]

        self.assertEqual(len(records), 3)
        self.assertIsInstance(records[0], DocumentRecord)
        self.assertIsInstance(records[1], DocumentVersionRecord)
        self.assertIsInstance(records[2], IngestionJobRecord)

        self.assertEqual(records[1].file_hash, "a" * 64)
        self.assertEqual(records[2].status, "queued")
        self.assertEqual(records[2].current_stage, "uploaded")

        self.db.commit.assert_called_once()

    def test_duplicate_document_is_rejected_before_storage(self):
        self.db.scalar.return_value = Mock(spec=DocumentVersionRecord)

        with self.assertRaises(DuplicateDocumentError):
            self.service.ingest(
                course_id="CS537",
                title="Lecture Notes",
                filename="lecture.pdf",
                declared_media_type="application/pdf",
                fileobj=BytesIO(b"%PDF-1.7\nStudySync"),
            )

        self.assertEqual(self.storage.uploaded, [])
        self.db.add_all.assert_not_called()
        self.db.commit.assert_not_called()

    def test_storage_object_is_deleted_when_database_commit_fails(self):
        self.db.commit.side_effect = RuntimeError("Database failure")

        with self.assertRaises(RuntimeError):
            self.service.ingest(
                course_id="CS537",
                title="Lecture Notes",
                filename="lecture.pdf",
                declared_media_type="application/pdf",
                fileobj=BytesIO(b"%PDF-1.7\nStudySync"),
            )

        self.db.rollback.assert_called_once()
        self.assertEqual(len(self.storage.uploaded), 1)
        self.assertEqual(self.storage.deleted, [self.storage.uploaded[0]["key"]])