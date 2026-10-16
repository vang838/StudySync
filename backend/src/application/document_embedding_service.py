from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import DocumentChunkRecord, IngestionJobRecord
from src.ports.embedding import EmbeddingPort


class DocumentEmbeddingError(Exception):
    """Base exception for document embedding failures."""


class EmbeddingJobNotFoundError(DocumentEmbeddingError):
    """Raised when the requested ingestion job does not exist."""


class EmbeddingChunksNotFoundError(DocumentEmbeddingError):
    """Raised when an ingestion job has no chunks to embed."""


@dataclass(frozen=True)
class EmbeddedChunk:
    chunk_id: str
    chunk_index: int
    vector: list[float]


class DocumentEmbeddingService:
    """Generate embeddings for persisted document chunks."""

    def __init__(self, db: Session, embedding_port: EmbeddingPort, batch_size: int) -> None:
        self._db = db
        self._embedding_port = embedding_port
        self._batch_size = batch_size

    def embed_job(self, *, job_id: str) -> list[EmbeddedChunk]:
        job = self._db.get(IngestionJobRecord, job_id)

        if job is None:
            raise EmbeddingJobNotFoundError(f"Ingestion job not found: {job_id}")

        chunks = list(
            self._db.scalars(
                select(DocumentChunkRecord)
                .where(DocumentChunkRecord.job_id == job_id)
                .order_by(DocumentChunkRecord.chunk_index)
            )
        )

        if not chunks:
            raise EmbeddingChunksNotFoundError(f"No document chunks found for ingestion job: {job_id}")

        embedded_chunks: list[EmbeddedChunk] = []
        for start in range(0, len(chunks), self._batch_size):
            batch = chunks[start:start + self._batch_size]

            vectors = self._embedding_port.embed([chunk.text for chunk in batch])
            embedded_chunks.extend(
                EmbeddedChunk(
                    chunk_id=chunk.chunk_id,
                    chunk_index=chunk.chunk_index,
                    vector=vector,
                )
                for chunk, vector in zip(batch, vectors, strict=True)
            )

        return embedded_chunks