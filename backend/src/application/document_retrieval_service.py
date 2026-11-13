from dataclasses import dataclass


from sqlalchemy.orm import Session
from sqlalchemy import or_, select
from src.db.models import (
    DocumentChunkRecord,
    DocumentOwnerRecord,
    DocumentRecord,
    DocumentVersionRecord,
    IngestionJobRecord,
)

from src.db.models import DocumentChunkRecord
from src.ports.embedding import EmbeddingPort
from src.ports.vector_store import VectorMetadataValue, VectorStorePort


class DocumentRetrievalError(Exception):
    """Base exception for document retrieval failures."""


@dataclass(frozen=True)
class RetrievedChunk:
    chunk_id: str
    text: str
    score: float
    metadata: dict[str, VectorMetadataValue]


class DocumentRetrievalService:
    """Retrieve document chunks relevant to a student's question."""

    def __init__(
        self,
        db: Session,
        embedding_port: EmbeddingPort,
        vector_store: VectorStorePort,
    ) -> None:
        self._db = db
        self._embedding_port = embedding_port
        self._vector_store = vector_store

    def retrieve(self, *, query: str, course_id: str, user_id: int, document_ids: list[str] | None = None, top_k: int = 5) -> list[RetrievedChunk]:
        query = query.strip()
        course_id = course_id.strip()

        if not query: raise DocumentRetrievalError("Retrieval query must not be empty")
        if not course_id: raise DocumentRetrievalError("course_id must not be empty")
        if user_id <= 0: raise DocumentRetrievalError("Authenticated user is required")
        if top_k <= 0: raise DocumentRetrievalError("top_k must be greater than zero")

        normalized_document_ids: list[str] | None = None
        if document_ids is not None:
            normalized_document_ids = list(dict.fromkeys(document_id.strip() for document_id in document_ids if document_id.strip()))
            if not normalized_document_ids:
                raise DocumentRetrievalError("document_ids must contain at least one non-empty document ID")

        statement = select(DocumentRecord.document_id).where(
            DocumentRecord.course_id == course_id,
            or_(
                DocumentRecord.is_published.is_(True),
                DocumentRecord.owners.any(DocumentOwnerRecord.user_id == user_id),
                DocumentRecord.publications.any(),
            ),
        )

        if normalized_document_ids is not None:
            statement = statement.where(DocumentRecord.document_id.in_(normalized_document_ids))

        authorized_ids = set(self._db.scalars(statement))

        if not authorized_ids: return []
        if normalized_document_ids is not None and not set(normalized_document_ids).issubset(authorized_ids): return []

        metadata_filter = {
            "$and": [
                {"course_id": {"$eq": course_id}},
                {"document_id": {"$in": sorted(authorized_ids)}},
            ]
        }

        query_vector = self._embedding_port.embed_query(query)
        matches = self._vector_store.search(query_vector=query_vector, top_k=top_k, metadata_filter=metadata_filter)

        if not matches: return []

        chunk_rows = self._db.execute(
            select(DocumentChunkRecord, DocumentVersionRecord.document_id, DocumentVersionRecord.version_id)
            .join(IngestionJobRecord, IngestionJobRecord.job_id == DocumentChunkRecord.job_id)
            .join(DocumentVersionRecord, DocumentVersionRecord.version_id == IngestionJobRecord.version_id)
            .where(
                DocumentChunkRecord.chunk_id.in_([match.record_id for match in matches]),
                DocumentVersionRecord.document_id.in_(authorized_ids),
            )
        )

        chunks_by_id = {
            chunk.chunk_id: (chunk, document_id, version_id)
            for chunk, document_id, version_id in chunk_rows
        }

        results: list[RetrievedChunk] = []

        for match in matches:
            entry = chunks_by_id.get(match.record_id)
            if entry is None: continue

            chunk, document_id, version_id = entry

            if match.metadata.get("course_id") != course_id: continue
            if match.metadata.get("document_id") != document_id: continue
            if match.metadata.get("version_id") != version_id: continue

            results.append(RetrievedChunk(
                chunk_id=chunk.chunk_id,
                text=chunk.text,
                score=match.score,
                metadata=match.metadata,
            ))

        return results