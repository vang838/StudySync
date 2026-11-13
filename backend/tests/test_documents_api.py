from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock

from fastapi.testclient import TestClient

from src.api.dependencies import get_current_user, get_document_ingestion_service
from src.application.document_ingestion_service import (
    DocumentIngestionResult,
    DocumentIngestionService,
    DuplicateDocumentError,
)
from src.main import app


class TestDocumentsAPI(TestCase):
    def setUp(self):
        self.previous_overrides = app.dependency_overrides.copy()
        self.service = Mock(spec=DocumentIngestionService)
        self.current_user = SimpleNamespace(user_id=1)
        app.dependency_overrides[get_document_ingestion_service] = lambda: self.service
        app.dependency_overrides[get_current_user] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous_overrides)

    def test_upload_document(self):
        self.service.ingest.return_value = DocumentIngestionResult(
            document_id="doc123",
            version_id="ver123",
            job_id="job123",
            course_id="CS537",
            title="Lecture Notes",
            original_filename="lecture.pdf",
            file_size_bytes=18,
            status="queued",
        )

        response = self.client.post(
            "/api/v1/documents",
            data={"course_id": "CS537", "title": "Lecture Notes"},
            files={"file": ("lecture.pdf", b"%PDF-1.7\nStudySync", "application/pdf")},
        )

        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertEqual(body["document_id"], "doc123")
        self.assertEqual(body["version_id"], "ver123")
        self.assertEqual(body["job_id"], "job123")
        self.assertEqual(body["status"], "queued")
        self.service.ingest.assert_called_once()
        self.assertEqual(self.service.ingest.call_args.kwargs["user_id"], 1)

    def test_duplicate_document_returns_conflict(self):
        self.service.ingest.side_effect = DuplicateDocumentError(
            "This document has already been uploaded to the course."
        )

        response = self.client.post(
            "/api/v1/documents",
            data={"course_id": "CS537", "title": "Lecture Notes"},
            files={"file": ("lecture.pdf", b"%PDF-1.7\nStudySync", "application/pdf")},
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["detail"], "This document has already been uploaded to the course.")

    def test_upload_requires_authentication(self):
        app.dependency_overrides.pop(get_current_user, None)

        response = self.client.post(
            "/api/v1/documents",
            data={"course_id": "CS537", "title": "Lecture Notes"},
            files={"file": ("lecture.pdf", b"%PDF-1.7\nStudySync", "application/pdf")},
        )

        self.assertEqual(response.status_code, 401)
        self.service.ingest.assert_not_called()