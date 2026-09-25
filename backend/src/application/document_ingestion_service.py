from dataclasses import dataclass
from typing import BinaryIO
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.application.docs_upload import DocumentUploadInspector
from src.db.models import DocumentRecord, DocumentVersionRecord, IngestionJobRecord
from src.ports.object_storage import ObjectStoragePort


class DuplicateDocumentError(Exception):
    pass


@dataclass(frozen=True)
class DocumentIngestionResult:
    document_id: str
    version_id: str
    job_id: str
    course_id: str
    title: str
    original_filename: str
    file_size_bytes: int
    status: str


class DocumentIngestionService:
    def __init__(self, db: Session, storage: ObjectStoragePort, inspector: DocumentUploadInspector):
        self._db = db
        self._storage = storage
        self._inspector = inspector

    def ingest(self, *, course_id: str, title: str, filename: str, declared_media_type: str | None, fileobj: BinaryIO) -> DocumentIngestionResult:
        inspection = self._inspector.inspect(
            filename=filename,
            declared_media_type=declared_media_type,
            fileobj=fileobj,
        )

        duplicate = self._db.scalar(
            select(DocumentVersionRecord)
            .join(DocumentRecord)
            .where(
                DocumentRecord.course_id == course_id,
                DocumentVersionRecord.file_hash == inspection.file_hash,
            )
        )

        if duplicate is not None:
            raise DuplicateDocumentError("This document has already been uploaded to the course.")

        document_id = uuid4().hex
        version_id = uuid4().hex
        job_id = uuid4().hex
        object_key = f"documents/{document_id}/versions/{version_id}/original{inspection.extension}"

        fileobj.seek(0)
        self._storage.upload(
            key=object_key,
            fileobj=fileobj,
            content_type=inspection.detected_media_type,
        )

        document = DocumentRecord(
            document_id=document_id,
            course_id=course_id,
            owner_ref=None,
            title=title,
        )

        version = DocumentVersionRecord(
            version_id=version_id,
            document_id=document_id,
            version_number=1,
            original_filename=inspection.original_filename,
            declared_media_type=inspection.declared_media_type,
            detected_media_type=inspection.detected_media_type,
            file_size_bytes=inspection.file_size_bytes,
            file_hash=inspection.file_hash,
            content_hash=None,
            object_key=object_key,
        )

        job = IngestionJobRecord(
            job_id=job_id,
            version_id=version_id,
            status="queued",
            current_stage="uploaded",
            pipeline_version="1",
        )

        self._db.add_all([document, version, job])

        try:
            self._db.commit()
        except Exception:
            self._db.rollback()

            try:
                self._storage.delete(key=object_key)
            except Exception:
                pass

            raise

        return DocumentIngestionResult(
            document_id=document_id,
            version_id=version_id,
            job_id=job_id,
            course_id=course_id,
            title=title,
            original_filename=inspection.original_filename,
            file_size_bytes=inspection.file_size_bytes,
            status="queued",
        )