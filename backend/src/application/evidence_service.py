from src.application.document_retrieval_service import RetrievedChunk
from src.ports.external_retrieval import ExternalRetrievalResult
from src.schemas.retrieval import (
    ChunkRetrievalMetadata,
    Evidence,
    ExternalEvidenceSource,
    InternalEvidenceSource,
)


class EvidenceService:
    """Normalize retrieval results into common evidence records."""

    def from_internal(self, chunk: RetrievedChunk) -> Evidence:
        metadata = ChunkRetrievalMetadata.model_validate(chunk.metadata)

        return Evidence(text=chunk.text, score=chunk.score, source=InternalEvidenceSource(metadata=metadata))

    def from_external(self, result: ExternalRetrievalResult) -> Evidence:
        return Evidence(
            text=result.text,
            score=result.score,
            source=ExternalEvidenceSource(
                provider=result.provider,
                title=result.title,
                url=result.url,
            ),
        )