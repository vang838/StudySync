from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from src.adapters.storage.local import LocalObjectStorageAdapter
from src.ports.object_storage import ObjectNotFoundError, ObjectStorageError


class TestLocalObjectStorageAdapter(TestCase):
    def test_upload_download_delete_cycle(self):
        with TemporaryDirectory() as tmp:
            storage = LocalObjectStorageAdapter(root_path=tmp)
            key = "documents/doc123/versions/ver123/original.txt"
            payload = b"hello local storage"

            storage.upload(key=key, fileobj=BytesIO(payload), content_type="text/plain")

            written_file = Path(tmp) / "documents" / "doc123" / "versions" / "ver123" / "original.txt"
            self.assertTrue(written_file.exists())

            destination = BytesIO()
            storage.download(key=key, fileobj=destination)
            self.assertEqual(destination.getvalue(), payload)

            storage.delete(key=key)
            self.assertFalse(written_file.exists())

    def test_download_missing_key(self):
        with TemporaryDirectory() as tmp:
            storage = LocalObjectStorageAdapter(root_path=tmp)

            with self.assertRaises(ObjectNotFoundError):
                storage.download(key="documents/missing.txt", fileobj=BytesIO())

    def test_rejects_path_traversal(self):
        with TemporaryDirectory() as tmp:
            storage = LocalObjectStorageAdapter(root_path=tmp)

            with self.assertRaises(ObjectStorageError):
                storage.upload(key="../outside.txt", fileobj=BytesIO(b"content"))
