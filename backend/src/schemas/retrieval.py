from typing import Annotated, Literal

from pydantic import BaseModel, Field


class ChunkRetrievalMetadata(BaseModel):
    document_id: str
    version_id: str
    chunk_id: str
    course_id: str
    owner_ref: str | None = None
    chunk_index: int = Field(ge=0)
    source_start_index: int | None = None
    source_end_index: int | None = None
    source_start_label: str | None = None
    source_end_label: str | None = None
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    section_title: str | None = None

    def to_vector_metadata(self) -> dict[str, str | int | bool]:
        return self.model_dump(exclude_none=True)


class InternalEvidenceSource(BaseModel):
    source_type: Literal["internal"] = "internal"
    metadata: ChunkRetrievalMetadata


class ExternalEvidenceSource(BaseModel):
    source_type: Literal["external"] = "external"
    provider: str = Field(min_length=1)
    title: str | None = None
    url: str = Field(min_length=1)

EvidenceSource = Annotated[
    InternalEvidenceSource | ExternalEvidenceSource,
    Field(discriminator="source_type"),
]

class Evidence(BaseModel):
    text: str = Field(min_length=1)
    score: float | None = None
    rank_score: float | None = None
    source: EvidenceSource

class InternalCitation(BaseModel):
    source_type: Literal["internal"] = "internal"
    document_id: str
    version_id: str
    chunk_id: str
    owner_ref: str | None = None
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    section_title: str | None = None


class ExternalCitation(BaseModel):
    source_type: Literal["external"] = "external"
    provider: str = Field(min_length=1)
    title: str | None = None
    url: str = Field(min_length=1)


Citation = Annotated[
    InternalCitation | ExternalCitation,
    Field(discriminator="source_type"),
]