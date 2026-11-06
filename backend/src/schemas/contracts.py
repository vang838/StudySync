from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, ConfigDict, Field, StringConstraints

from src.schemas.retrieval import Citation

class UpdateUserRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: EmailStr

class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class AuthRegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: EmailStr
    password: str = Field(min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


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

class ChatCreateRequest(BaseModel):
    course_id: str | None = None
    question: str = Field(min_length=1)

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

class ChatCreateResponse(ChatThread):
    mode: Literal["general", "course"]
    citations: list[Citation]

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

class CardInput(BaseModel):
    flashcard_id: int | None = Field(default=None, gt=0)
    question: NonEmptyText
    answer: NonEmptyText

class SetInput(BaseModel):
    course_id: NonEmptyText
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
