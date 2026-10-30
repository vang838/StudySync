from hashlib import sha256
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


class ChunkRetrievalMetadata(BaseModel):
    document_id: str
    version_id: str
    chunk_id: str
    course_id: str
    original_filename: str | None = None
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
    evidence_id: str | None = None
    text: str = Field(min_length=1)
    score: float | None = None
    rank_score: float | None = None
    authority: Literal["course_material", "government_or_education", "nonprofit", "general_web"] | None = None
    quality_score: float | None = Field(default=None, ge=0.0, le=1.0)
    source: EvidenceSource

    @model_validator(mode="after")
    def assign_evidence_id(self) -> "Evidence":
        if self.evidence_id:
            return self

        if self.source.source_type == "internal":
            self.evidence_id = f"internal:{self.source.metadata.chunk_id}"
        else:
            digest = sha256(self.source.url.encode("utf-8")).hexdigest()[:16]
            self.evidence_id = f"external:{self.source.provider}:{digest}"

        return self


class ClaimEvidenceAssociation(BaseModel):
    evidence_id: str = Field(min_length=1)
    relationship: Literal["supports", "contradicts", "irrelevant"]
    confidence: float = Field(ge=0.0, le=1.0)


class GeneratedClaim(BaseModel):
    claim_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    evidence: list[ClaimEvidenceAssociation]
    has_agreement: bool = False
    has_conflict: bool = False
    is_insufficient: bool = False


class InternalCitation(BaseModel):
    source_type: Literal["internal"] = "internal"
    evidence_id: str | None = None
    claim_ids: list[str] = Field(default_factory=list)
    document_id: str
    original_filename: str | None = None
    version_id: str
    chunk_id: str
    owner_ref: str | None = None
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    section_title: str | None = None


class ExternalCitation(BaseModel):
    source_type: Literal["external"] = "external"
    evidence_id: str | None = None
    claim_ids: list[str] = Field(default_factory=list)
    provider: str = Field(min_length=1)
    title: str | None = None
    url: str = Field(min_length=1)


Citation = Annotated[
    InternalCitation | ExternalCitation,
    Field(discriminator="source_type"),
]
