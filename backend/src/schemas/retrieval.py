from pydantic import BaseModel, Field


class ChunkRetrievalMetadata(BaseModel):
    document_id: str
    version_id: str
    chunk_id: str
    course_id: str
    owner_ref: str | None = None

    chunk_index: int = Field(ge=0)
    page_start: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    section_title: str | None = None

    def to_vector_metadata(self) -> dict[str, str | int | bool]:
        return self.model_dump(exclude_none=True)