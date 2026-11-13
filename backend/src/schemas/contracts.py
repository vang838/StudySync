from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator, model_validator

def validate_password_strength(value: str) -> str:
    if len(value) < 8 or not any(character.isupper() for character in value) or not any(
        not character.isalnum() for character in value
    ):
        raise ValueError("Password must be at least 8 characters and include an uppercase letter and special character.")
    return value

from src.schemas.retrieval import Citation, GeneratedClaim

class UpdateUserRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: EmailStr
    password: str | None = Field(default=None, min_length=8)

    @field_validator("password")
    @classmethod
    def validate_optional_password(cls, value: str | None) -> str | None:
        return validate_password_strength(value) if value is not None else None

class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class AuthRegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: EmailStr
    password: str = Field(min_length=8)

    _validate_password = field_validator("password")(validate_password_strength)

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class PasswordResetRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

    _validate_password = field_validator("password")(validate_password_strength)

class CourseCreateRequest(BaseModel):
    course_id: str = Field(min_length=2, max_length=128)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    subject: str = Field(min_length=1, max_length=128)
    year: int = Field(ge=1900, le=2100)
    professor: str | None = Field(default=None, max_length=200)

class SaveCourseRequest(BaseModel):
    user_id: int = Field(ge=1)

class ForumPostCreateRequest(BaseModel):
    user_id: int = Field(ge=1)
    content: str = Field(min_length=1, max_length=4000)
    parent_post_id: int | None = Field(default=None, ge=1)

class ForumPostUpdateRequest(BaseModel):
    user_id: int = Field(ge=1)
    content: str = Field(min_length=1, max_length=4000)

class ProfessorReviewCreateRequest(BaseModel):
    professor: str = Field(min_length=1, max_length=200)
    course_id: str = Field(min_length=2, max_length=128)
    rating: int = Field(ge=1, le=5)
    feedback: str = Field(min_length=1, max_length=4000)
    user_id: int | None = Field(default=None, ge=1)

class DocumentUploadRequest(BaseModel):
    course_id: str
    title: str = Field(min_length=1, max_length=200)
    source_url: str | None = None

class DocumentUploadResponse(BaseModel):
    document_id: str
    version_id: str
    job_id: str
    course_id: str
    title: str
    original_filename: str
    file_size_bytes: int
    status: str

class DocumentPublisherResponse(BaseModel):
    user_id: int
    name: str
    public_id: str | None = None

class DocumentListItemResponse(BaseModel):
    document_id: str
    version_id: str
    course_id: str
    title: str
    is_published: bool
    original_filename: str
    file_size_bytes: int
    created_at: datetime
    published_by: list[DocumentPublisherResponse] = Field(default_factory=list)
    is_published_by_current_user: bool = False

class DocumentPublishRequest(BaseModel):
    is_published: bool

class DocumentPublishResponse(BaseModel):
    document_id: str
    is_published: bool
    published_by: list[DocumentPublisherResponse] = Field(default_factory=list)
    is_published_by_current_user: bool = False

class DocumentDeleteResponse(BaseModel):
    document_id: str
    deleted: bool
    storage_cleanup_status: Literal["complete", "partial"]
    storage_cleanup_failed_keys: list[str]

class ChatCreateRequest(BaseModel):
    course_id: str | None = None
    question: str = Field(min_length=1)
    hint_level: Literal[1, 2, 3, 4] | None = None
    source_scope: Literal["documents", "external", "both"] = "both"
    document_ids: list[str] | None = None
    
    @model_validator(mode="after")
    def validate_source_selection(self) -> "ChatCreateRequest":
        if self.source_scope != "both" and not (self.course_id or "").strip():
            raise ValueError("A course is required when selecting a retrieval source.")

        if self.document_ids is not None:
            if self.source_scope == "external" or not (self.course_id or "").strip():
                raise ValueError("Document selection requires course document retrieval.")

            self.document_ids = list(dict.fromkeys(doc.strip() for doc in self.document_ids if doc.strip()))
            if not self.document_ids: raise ValueError("document_ids must not be empty.")

        return self
    
class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime

class ChatThread(BaseModel):
    chat_id: str
    course_id: str | None
    question: str
    answer: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessage]
    mode: Literal["general", "course"]
    evidence_status: Literal["not_applicable", "sufficient", "conflicting", "insufficient"]
    citations: list[Citation]
    claims: list[GeneratedClaim]

class CardInput(BaseModel):
    flashcard_id: int | None = Field(default=None, gt=0)
    question: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    answer: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

class SetInput(BaseModel):
    course_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    description: str | None = None
    cards: list[CardInput] = Field(min_length=1)

class CardOut(CardInput):
    model_config = ConfigDict(from_attributes=True)

    flashcard_id: int
    position: int

class SetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    flashcardsets_id: int
    user_id: int
    course_id: str
    title: str
    description: str | None
    created_at: datetime
    cards: list[CardOut]

class RatingInput(BaseModel):
    rating: Literal["easy", "practice", "hard"]

class ChatCreateResponse(ChatThread):
    pass
