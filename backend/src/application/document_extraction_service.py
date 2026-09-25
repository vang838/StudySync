from tempfile import SpooledTemporaryFile

from sqlalchemy.orm import Session

from src.application.document_parser import DocumentParserRegistry, ExtractedDocument
from src.db.models import DocumentVersionRecord
from src.ports.object_storage import ObjectStoragePort


class DocumentVersionNotFoundError(Exception):
    pass


class DocumentExtractionService:
    def __init__(self, db: Session, storage: ObjectStoragePort, parser_registry: DocumentParserRegistry):
        self._db = db
        self._storage = storage
        self._parser_registry = parser_registry

    def extract(self, *, version_id: str) -> ExtractedDocument:
        version = self._db.get(DocumentVersionRecord, version_id)

        if version is None:
            raise DocumentVersionNotFoundError(f"Document version '{version_id}' was not found.")

        if not version.detected_media_type:
            raise RuntimeError("Document version does not have a detected media type.")

        parser = self._parser_registry.get(version.detected_media_type)

        with SpooledTemporaryFile(max_size=5 * 1024 * 1024, mode="w+b") as fileobj:
            self._storage.download(key=version.object_key, fileobj=fileobj)
            fileobj.seek(0)

            return parser.parse(fileobj)