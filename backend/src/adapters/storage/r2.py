from typing import BinaryIO

from botocore.exceptions import BotoCoreError, ClientError

from src.ports.object_storage import (
    ObjectNotFoundError,
    ObjectStorageError,
    ObjectStoragePort,
    ObjectStorageUnavailableError,
)


class R2ObjectStorageAdapter(ObjectStoragePort):
    def __init__(self, client, bucket_name: str):
        self._client = client
        self._bucket_name = bucket_name

    def upload(self, *, key: str, fileobj: BinaryIO, content_type: str | None = None) -> None:
        extra_args = {}

        if content_type is not None:
            extra_args["ContentType"] = content_type

        try:
            if extra_args:
                self._client.upload_fileobj(fileobj, self._bucket_name, key, ExtraArgs=extra_args)
            else:
                self._client.upload_fileobj(fileobj, self._bucket_name, key)
        except BotoCoreError as exc:
            raise ObjectStorageUnavailableError("Object storage is unavailable.") from exc
        except ClientError as exc:
            raise ObjectStorageError("Object upload failed.") from exc

    def download(self, *, key: str, fileobj: BinaryIO) -> None:
        try:
            self._client.download_fileobj(self._bucket_name, key, fileobj)
        except ClientError as exc:
            error_code = exc.response.get("Error", {}).get("Code")

            if error_code in {"404", "NoSuchKey", "NotFound"}:
                raise ObjectNotFoundError(f"Object '{key}' was not found.") from exc

            raise ObjectStorageError("Object download failed.") from exc
        except BotoCoreError as exc:
            raise ObjectStorageUnavailableError("Object storage is unavailable.") from exc

    def delete(self, *, key: str) -> None:
        try:
            self._client.delete_object(Bucket=self._bucket_name, Key=key)
        except BotoCoreError as exc:
            raise ObjectStorageUnavailableError("Object storage is unavailable.") from exc
        except ClientError as exc:
            raise ObjectStorageError("Object deletion failed.") from exc