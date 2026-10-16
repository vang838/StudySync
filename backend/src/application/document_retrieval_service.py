from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

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

    def retrieve(self, *, query: str, course_id: str, document_ids: list[str] | None = None, top_k: int = 5) -> list[RetrievedChunk]:
        query = query.strip()
        course_id = course_id.strip()

        if not query:
            raise DocumentRetrievalError("Retrieval query must not be empty")

        if not course_id:
            raise DocumentRetrievalError(
            "course_id must not be empty")

        if top_k <= 0:
            raise DocumentRetrievalError("top_k must be greater than zero")

        normalized_document_ids: list[str] | None = None

        if document_ids is not None:
            normalized_document_ids = [
                document_id.strip()
                for document_id in document_ids
                if document_id.strip()
            ]

            if not normalized_document_ids:
                raise DocumentRetrievalError("document_ids must contain at least one non-empty document ID")

            normalized_document_ids = list(dict.fromkeys(normalized_document_ids))

        query_vector = self._embedding_port.embed_query(query)

        metadata_filter: dict[str, object] = {
            "course_id": {
                "$eq": course_id,
            }
        }

        if normalized_document_ids is not None:
            metadata_filter = {
                "$and": [
                    {
                        "course_id": {
                            "$eq": course_id,
                        }
                    },
                    {
                        "document_id": {
                            "$in": normalized_document_ids,
                        }
                    },
                ]
            }

        matches = self._vector_store.search(query_vector=query_vector, top_k=top_k, metadata_filter=metadata_filter)

        if not matches:
            return []
        
        chunk_ids = [
            match.record_id
            for match in matches
        ]

        chunks = list(
            self._db.scalars(
                select(DocumentChunkRecord).where(DocumentChunkRecord.chunk_id.in_(chunk_ids))
            )
        )

        chunks_by_id = {
            chunk.chunk_id: chunk
            for chunk in chunks
        }

        results: list[RetrievedChunk] = []

        for match in matches:
            chunk = chunks_by_id.get(match.record_id)

            if chunk is None:
                continue

            results.append(
                RetrievedChunk(chunk_id=chunk.chunk_id, text=chunk.text, score=match.score, metadata=match.metadata)
            )

        return results