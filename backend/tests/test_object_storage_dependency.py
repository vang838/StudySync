from unittest import TestCase
from unittest.mock import Mock, patch

from src.adapters.storage.local import LocalObjectStorageAdapter
from src.adapters.storage.r2 import R2ObjectStorageAdapter
from src.api.dependencies import get_object_storage


class TestObjectStorageDependency(TestCase):
    def test_returns_local_adapter_when_provider_is_local(self):
        with (
            patch("src.api.dependencies.settings.object_storage_provider", "local"),
            patch("src.api.dependencies.settings.local_object_storage_root", "tmp-storage"),
        ):
            storage = get_object_storage()

        self.assertIsInstance(storage, LocalObjectStorageAdapter)

    def test_returns_r2_adapter_when_provider_is_r2(self):
        mock_client = Mock()

        with (
            patch("src.api.dependencies.settings.object_storage_provider", "r2"),
            patch("src.api.dependencies.settings.r2_endpoint_url", "https://example.r2.cloudflarestorage.com"),
            patch("src.api.dependencies.settings.r2_access_key_id", "key"),
            patch("src.api.dependencies.settings.r2_secret_access_key", "secret"),
            patch("src.api.dependencies.settings.r2_bucket_name", "bucket"),
            patch("src.api.dependencies.boto3.client", return_value=mock_client),
        ):
            storage = get_object_storage()

        self.assertIsInstance(storage, R2ObjectStorageAdapter)

    def test_unsupported_provider_raises_error(self):
        with patch("src.api.dependencies.settings.object_storage_provider", "unknown"):
            with self.assertRaises(RuntimeError):
                get_object_storage()
