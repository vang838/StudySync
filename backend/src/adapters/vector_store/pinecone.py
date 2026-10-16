from typing import Any

from pinecone import (
    DenseVectorQuery,
    PineconeConnectionError,
    PineconeError,
    PineconeTimeoutError,
)

from src.ports.vector_store import (
    VectorMetadataValue,
    VectorRecord,
    VectorSearchResult,
    VectorStoreResponseError,
    VectorStoreUnavailableError,
)


class PineconeVectorStoreAdapter:
    """Adapter for storing embeddings in a Pinecone document index."""

    def __init__(self, index: Any, namespace: str, embedding_field: str = "embedding", batch_size: int = 50) -> None:
        if not namespace.strip():
            raise ValueError("Pinecone namespace must not be empty.")

        if batch_size <= 0 or batch_size > 1000:
            raise ValueError("Pinecone batch size must be between 1 and 1000.")

        self._index = index
        self._namespace = namespace
        self._embedding_field = embedding_field
        self._batch_size = batch_size

    def upsert(self, records: list[VectorRecord]) -> int:
        if not records:
            return 0

        documents = []

        for record in records:
            if "_id" in record.metadata:
                raise VectorStoreResponseError("Vector metadata must not contain reserved field '_id'.")

            if self._embedding_field in record.metadata:
                raise VectorStoreResponseError(
                    f"Vector metadata must not contain reserved field '{self._embedding_field}'."
                )

            documents.append(
                {
                    "_id": record.record_id,
                    self._embedding_field: record.vector,
                    **record.metadata,
                }
            )

        total_upserted = 0

        try:
            for start in range(0, len(documents), self._batch_size):
                batch = documents[start:start + self._batch_size]

                response = self._index.documents.upsert(
                    namespace=self._namespace,
                    documents=batch,
                )

                total_upserted += response.upserted_count

        except (PineconeConnectionError, PineconeTimeoutError) as exc:
            raise VectorStoreUnavailableError("Vector store unavailable") from exc

        except PineconeError as exc:
            raise VectorStoreResponseError("Vector store rejected request") from exc

        if total_upserted != len(records):
            raise VectorStoreResponseError("Vector store returned unexpected upsert count")

        return total_upserted

    def search(
        self,
        query_vector: list[float],
        top_k: int,
        metadata_filter: dict[str, object] | None = None,
    ) -> list[VectorSearchResult]:
        if not query_vector:
            raise VectorStoreResponseError(
                "Query vector must not be empty"
            )

        if top_k <= 0:
            raise VectorStoreResponseError(
                "top_k must be greater than zero"
            )

        include_fields = [
            "document_id",
            "version_id",
            "chunk_id",
            "course_id",
            "owner_ref",
            "chunk_index",
            "source_start_index",
            "source_end_index",
            "source_start_label",
            "source_end_label",
            "page_start",
            "page_end",
            "section_title",
        ]

        try:
            response = self._index.documents.search(
                namespace=self._namespace,
                score_by=[
                    DenseVectorQuery(
                        field=self._embedding_field,
                        values=query_vector,
                    )
                ],
                top_k=top_k,
                include_fields=include_fields,
                filter=metadata_filter,
            )

        except (PineconeConnectionError, PineconeTimeoutError) as exc:
            raise VectorStoreUnavailableError(
                "Vector store unavailable"
            ) from exc

        except PineconeError as exc:
            raise VectorStoreResponseError(
                "Vector store rejected search request"
            ) from exc

        results: list[VectorSearchResult] = []

        for match in response.matches:
            metadata: dict[str, VectorMetadataValue] = {}

            for field in include_fields:
                value = match.get(field)

                if value is not None:
                    if (
                        field.endswith("_index")
                        and isinstance(value, float)
                        and value.is_integer()
                    ):
                        value = int(value)

                    metadata[field] = value

            results.append(
                VectorSearchResult(
                    record_id=match.id,
                    score=float(match.score),
                    metadata=metadata,
                )
            )

        return results