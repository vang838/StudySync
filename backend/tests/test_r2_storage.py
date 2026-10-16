from io import BytesIO
from unittest import TestCase
from unittest.mock import Mock

from botocore.exceptions import ClientError

from src.adapters.storage.r2 import R2ObjectStorageAdapter
from src.ports.object_storage import ObjectNotFoundError


class TestR2ObjectStorageAdapter(TestCase):
    def setUp(self):
        self.client = Mock()
        self.storage = R2ObjectStorageAdapter(client=self.client, bucket_name="test-bucket")

    def test_upload(self):
        fileobj = BytesIO(b"hello")

        self.storage.upload(
            key="documents/doc123/original",
            fileobj=fileobj,
            content_type="text/plain",
        )

        self.client.upload_fileobj.assert_called_once_with(
            fileobj,
            "test-bucket",
            "documents/doc123/original",
            ExtraArgs={"ContentType": "text/plain"},
        )

    def test_download(self):
        destination = BytesIO()

        self.storage.download(key="documents/doc123/original", fileobj=destination)

        self.client.download_fileobj.assert_called_once_with(
            "test-bucket",
            "documents/doc123/original",
            destination,
        )

    def test_delete(self):
        self.storage.delete(key="documents/doc123/original")

        self.client.delete_object.assert_called_once_with(Bucket="test-bucket", Key="documents/doc123/original")

    def test_missing_object(self):
        self.client.download_fileobj.side_effect = ClientError(
            {
                "Error": {
                    "Code": "NoSuchKey",
                    "Message": "Not found",
                }
            },
            "GetObject",
        )

        with self.assertRaises(ObjectNotFoundError):
            self.storage.download(key="missing", fileobj=BytesIO())