from datetime import datetime, timezone
from unittest import TestCase

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from src.api.dependencies import get_current_user, get_object_storage, get_optional_current_user
from src.db.base import Base
from src.db.models import DocumentOwnerRecord, DocumentPublicationRecord, DocumentRecord, DocumentVersionRecord, User
from src.db.session import get_db
from src.main import app
from src.ports.object_storage import ObjectStorageError

class _FakeStorage:
    def __init__(self, failing_keys: set[str] | None = None):
        self.deleted_keys: list[str] = []
        self.downloaded_keys: list[str] = []
        self._failing_keys = failing_keys or set()

    def upload(self, *, key, fileobj, content_type=None):
        raise NotImplementedError

    def download(self, *, key, fileobj):
        self.downloaded_keys.append(key)
        fileobj.write(b"document-bytes")

    def delete(self, *, key):
        if key in self._failing_keys:
            raise ObjectStorageError("Deletion failure")
        self.deleted_keys.append(key)


class TestDocumentsManagementApi(TestCase):
    def setUp(self):
        self.previous_overrides = app.dependency_overrides.copy()
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.current_user = User(
            user_first_name="Alice", user_last_name="Student",
            user_email="alice@example.com", password_hash="test-only-hash",
        )
        self.other_user = User(
            user_first_name="Bob", user_last_name="Student",
            user_email="bob@example.com", password_hash="test-only-hash",
        )
        self.db.add_all([self.current_user, self.other_user])
        self.db.commit()
        self.storage = _FakeStorage()

        def _override_get_db():
            yield self.db

        app.dependency_overrides[get_db] = _override_get_db
        app.dependency_overrides[get_object_storage] = lambda: self.storage
        app.dependency_overrides[get_current_user] = lambda: self.current_user
        app.dependency_overrides[get_optional_current_user] = lambda: self.current_user
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        app.dependency_overrides.update(self.previous_overrides)
        self.db.close()
        self.engine.dispose()

    def _insert_document(
        self, *, document_id: str, course_id: str, title: str,
        version_id: str, object_key: str, is_published: bool = False,
        owner_id: int | None = None,
    ):
        document = DocumentRecord(
            document_id=document_id,
            course_id=course_id,
            owner_ref=None,
            title=title,
            is_published=is_published,
        )
        version = DocumentVersionRecord(
            version_id=version_id,
            document_id=document_id,
            version_number=1,
            original_filename=f"{title}.pdf",
            declared_media_type="application/pdf",
            detected_media_type="application/pdf",
            file_size_bytes=128,
            file_hash=f"{document_id:0<64}"[:64],
            content_hash=None,
            object_key=object_key,
            created_at=datetime.now(timezone.utc),
        )
        owner = DocumentOwnerRecord(
            document_id=document_id,
            user_id=owner_id if owner_id is not None else self.current_user.user_id,
        )
        self.db.add_all([document, version])
        self.db.flush()
        self.db.add(owner)
        self.db.commit()

    def test_list_documents(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
            is_published=True, owner_id=self.other_user.user_id,
        )
        self._insert_document(
            document_id="doc2", course_id="CS102", title="Week 2 Notes",
            version_id="ver2", object_key="documents/doc2/versions/ver2/original.pdf",
        )
        app.dependency_overrides[get_optional_current_user] = lambda: None

        response = self.client.get("/api/v1/documents")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["document_id"], "doc1")
        self.assertTrue(body[0]["is_published"])

    def test_list_documents_with_course_filter(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
        )
        self._insert_document(
            document_id="doc2", course_id="CS102", title="Week 2 Notes",
            version_id="ver2", object_key="documents/doc2/versions/ver2/original.pdf",
            is_published=True,
        )

        response = self.client.get("/api/v1/documents", params={"course_id": "CS101"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_list_documents_with_private_included(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
        )
        self._insert_document(
            document_id="doc2", course_id="CS102", title="Week 2 Notes",
            version_id="ver2", object_key="documents/doc2/versions/ver2/original.pdf",
            is_published=True,
        )
        self._insert_document(
            document_id="doc3", course_id="CS103", title="Someone Else's Notes",
            version_id="ver3", object_key="documents/doc3/versions/ver3/original.pdf",
            owner_id=self.other_user.user_id,
        )

        response = self.client.get("/api/v1/documents", params={"published_only": "false"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body), 2)
        self.assertEqual({item["document_id"] for item in body}, {"doc1", "doc2"})

    def test_private_list_requires_authentication(self):
        app.dependency_overrides[get_optional_current_user] = lambda: None
        response = self.client.get("/api/v1/documents", params={"published_only": "false"})
        self.assertEqual(response.status_code, 401)

    def test_download_document(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
        )

        response = self.client.get("/api/v1/documents/doc1/download")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"document-bytes")
        self.assertIn('attachment; filename="Week 1 Notes.pdf"', response.headers["content-disposition"])

    def test_preview_document(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
        )

        response = self.client.get("/api/v1/documents/doc1/download", params={"preview": True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"document-bytes")
        self.assertIn('inline; filename="Week 1 Notes.pdf"', response.headers["content-disposition"])

    def test_private_download_requires_owner(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Private Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
            owner_id=self.other_user.user_id,
        )

        response = self.client.get("/api/v1/documents/doc1/download")
        self.assertEqual(response.status_code, 404)
        app.dependency_overrides[get_optional_current_user] = lambda: None
        response = self.client.get("/api/v1/documents/doc1/download")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(self.storage.downloaded_keys, [])

    def test_published_download_allows_anonymous(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Public Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
            is_published=True, owner_id=self.other_user.user_id,
        )
        app.dependency_overrides[get_optional_current_user] = lambda: None

        response = self.client.get("/api/v1/documents/doc1/download")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"document-bytes")

    def test_publish_document(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
        )

        response = self.client.patch("/api/v1/documents/doc1/publish", json={"is_published": True})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["document_id"], "doc1")
        self.assertTrue(body["is_published"])
        self.assertTrue(body["is_published_by_current_user"])
        publication = self.db.scalar(select(DocumentPublicationRecord).where(
            DocumentPublicationRecord.document_id == "doc1",
            DocumentPublicationRecord.user_id == self.current_user.user_id,
        ))
        self.assertIsNotNone(publication)

    def test_publish_document_not_found(self):
        response = self.client.patch("/api/v1/documents/missing/publish", json={"is_published": True})
        self.assertEqual(response.status_code, 404)

    def test_other_user_cannot_modify_document(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Someone Else's Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
            owner_id=self.other_user.user_id,
        )

        self.assertEqual(self.client.patch(
            "/api/v1/documents/doc1/publish", json={"is_published": True},
        ).status_code, 403)
        self.assertEqual(self.client.delete("/api/v1/documents/doc1").status_code, 403)
        self.assertIsNotNone(self.db.get(DocumentRecord, "doc1"))
        self.assertEqual(self.storage.deleted_keys, [])

    def test_delete_document(self):
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
        )

        response = self.client.delete("/api/v1/documents/doc1")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["deleted"])
        self.assertEqual(body["storage_cleanup_status"], "complete")
        self.assertIsNone(self.db.get(DocumentRecord, "doc1"))
        self.assertEqual(self.storage.deleted_keys, ["documents/doc1/versions/ver1/original.pdf"])

    def test_delete_document_partial_cleanup(self):
        self.storage = _FakeStorage(failing_keys={"documents/doc1/versions/ver1/original.pdf"})
        self._insert_document(
            document_id="doc1", course_id="CS101", title="Week 1 Notes",
            version_id="ver1", object_key="documents/doc1/versions/ver1/original.pdf",
        )

        response = self.client.delete("/api/v1/documents/doc1")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["storage_cleanup_status"], "partial")
        self.assertEqual(body["storage_cleanup_failed_keys"], ["documents/doc1/versions/ver1/original.pdf"])
        self.assertIsNone(self.db.get(DocumentRecord, "doc1"))

    def test_delete_document_not_found(self):
        response = self.client.delete("/api/v1/documents/missing")
        self.assertEqual(response.status_code, 404)