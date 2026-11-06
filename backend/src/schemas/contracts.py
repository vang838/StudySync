from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field
from pydantic import field_validator


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


class ChatCreateResponse(ChatThread):
    pass
