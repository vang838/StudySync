from sqlalchemy import select
from sqlalchemy.orm import Session

from src.application.document_embedding_service import DocumentEmbeddingService
from src.db.models import (
    DocumentChunkRecord,
    DocumentRecord,
    DocumentVersionRecord,
    IngestionJobRecord,
)
from src.ports.vector_store import VectorRecord, VectorStorePort
from src.schemas.retrieval import ChunkRetrievalMetadata


class DocumentVectorIndexingError(Exception):
    """Base exception for document vector indexing failures."""


class IndexingJobNotFoundError(DocumentVectorIndexingError):
    """Raised when the requested ingestion job does not exist."""


class IndexingVersionNotFoundError(DocumentVectorIndexingError):
    """Raised when the ingestion job's document version does not exist."""


class IndexingDocumentNotFoundError(DocumentVectorIndexingError):
    """Raised when the document record does not exist."""


class DocumentVectorIndexingService:
    """Embed persisted chunks and store them in the vector store."""

    def __init__(
        self,
        db: Session,
        embedding_service: DocumentEmbeddingService,
        vector_store: VectorStorePort,
    ) -> None:
        self._db = db
        self._embedding_service = embedding_service
        self._vector_store = vector_store

    def index_job(self, *, job_id: str) -> int:
        job = self._db.get(IngestionJobRecord, job_id)
        if job is None:
            raise IndexingJobNotFoundError(f"Ingestion job not found: {job_id}")

        version = self._db.get(DocumentVersionRecord,job.version_id,)
        if version is None:
            raise IndexingVersionNotFoundError(f"Document version not found: {job.version_id}")

        document = self._db.get(DocumentRecord,version.document_id,)
        if document is None:
            raise IndexingDocumentNotFoundError(f"Document not found: {version.document_id}")

        chunks = list(
            self._db.scalars(
                select(DocumentChunkRecord)
                .where(DocumentChunkRecord.job_id == job_id)
                .order_by(DocumentChunkRecord.chunk_index)
            )
        )

        embedded_chunks = self._embedding_service.embed_job(job_id=job_id)
        chunks_by_id = {
            chunk.chunk_id: chunk
            for chunk in chunks
        }
        records: list[VectorRecord] = []
        
        for embedded_chunk in embedded_chunks:
            chunk = chunks_by_id[embedded_chunk.chunk_id]

            metadata = ChunkRetrievalMetadata(
                document_id=document.document_id,
                version_id=version.version_id,
                chunk_id=chunk.chunk_id,
                course_id=document.course_id,
                owner_ref=document.owner_ref,
                chunk_index=chunk.chunk_index,
                source_start_index=chunk.source_start_index,
                source_end_index=chunk.source_end_index,
                source_start_label=chunk.source_start_label,
                source_end_label=chunk.source_end_label,
                page_start=chunk.page_start,
                page_end=chunk.page_end,
                section_title=chunk.section_title,
            )

            records.append(
                VectorRecord(
                    record_id=chunk.chunk_id,
                    vector=embedded_chunk.vector,
                    metadata=metadata.to_vector_metadata(),
                )
            )

        upserted = self._vector_store.upsert(records)

        job.status = "ready"
        job.current_stage = "indexed"
        self._db.commit()

        return upserted