from pathlib import Path
from typing import BinaryIO

from src.ports.object_storage import ObjectNotFoundError, ObjectStorageError, ObjectStoragePort


class LocalObjectStorageAdapter(ObjectStoragePort):
    def __init__(self, root_path: str):
        self._root = Path(root_path).expanduser().resolve()

    def upload(self, *, key: str, fileobj: BinaryIO, content_type: str | None = None) -> None:
        destination = self._resolve_key_path(key)
        destination.parent.mkdir(parents=True, exist_ok=True)

        fileobj.seek(0)
        with destination.open("wb") as handle:
            while chunk := fileobj.read(1024 * 1024):
                handle.write(chunk)
        fileobj.seek(0)

    def download(self, *, key: str, fileobj: BinaryIO) -> None:
        source = self._resolve_key_path(key)

        if not source.exists() or not source.is_file():
            raise ObjectNotFoundError(f"Object '{key}' was not found.")

        with source.open("rb") as handle:
            while chunk := handle.read(1024 * 1024):
                fileobj.write(chunk)

    def delete(self, *, key: str) -> None:
        target = self._resolve_key_path(key)

        if not target.exists():
            return

        if not target.is_file():
            raise ObjectStorageError(f"Object key '{key}' does not map to a file.")

        target.unlink()

    def _resolve_key_path(self, key: str) -> Path:
        normalized = key.strip("/")
        candidate = (self._root / normalized).resolve()

        if not candidate.is_relative_to(self._root):
            raise ObjectStorageError("Object key is outside local storage root.")

        return candidate
