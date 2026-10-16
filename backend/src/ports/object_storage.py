from typing import BinaryIO, Protocol


class ObjectStorageError(Exception):
    pass


class ObjectStorageUnavailableError(ObjectStorageError):
    pass


class ObjectNotFoundError(ObjectStorageError):
    pass


class ObjectStoragePort(Protocol):
    def upload(self, *, key: str, fileobj: BinaryIO, content_type: str | None = None,) -> None:
        ...

    def download(self, *, key: str, fileobj: BinaryIO,) -> None:
        ...

    def delete(self, *, key: str,) -> None:
        ...