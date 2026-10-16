from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.orm import Session

from src.application.document_chunker import DocumentChunker
from src.application.document_normalization_service import DocumentNormalizationService
from src.db.models import DocumentChunkRecord, IngestionJobRecord


class IngestionJobNotFoundError(Exception):
    pass


class DocumentChunkingService:
    def __init__(self, db: Session, normalization_service: DocumentNormalizationService, chunker: DocumentChunker):
        self._db = db
        self._normalization_service = normalization_service
        self._chunker = chunker

    def process(self, *, job_id: str) -> list[DocumentChunkRecord]:
        job = self._db.get(IngestionJobRecord, job_id)

        if job is None:
            raise IngestionJobNotFoundError(f"Ingestion job '{job_id}' was not found.")

        normalized = self._normalization_service.normalize(version_id=job.version_id)
        chunks = self._chunker.chunk(normalized)

        self._db.execute(delete(DocumentChunkRecord).where(DocumentChunkRecord.job_id == job_id))

        records = []

        for chunk in chunks:
            page_start = chunk.source_start_index if chunk.source_start_label.startswith("page:") else None
            page_end = chunk.source_end_index if chunk.source_end_label.startswith("page:") else None

            records.append(
                DocumentChunkRecord(
                    chunk_id=uuid4().hex,
                    job_id=job_id,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                    page_start=page_start,
                    page_end=page_end,
                    section_title=None,
                    token_count=None,
                    source_start_index=chunk.source_start_index,
                    source_end_index=chunk.source_end_index,
                    source_start_label=chunk.source_start_label,
                    source_end_label=chunk.source_end_label,
                )
            )

        self._db.add_all(records)

        job.status = "processing"
        job.current_stage = "chunked"

        self._db.commit()

        return records