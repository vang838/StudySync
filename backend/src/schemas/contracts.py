from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


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


class AuthRegisterRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: EmailStr
    password: str = Field(min_length=8)


class CourseCreateRequest(BaseModel):
    course_id: str = Field(min_length=2, max_length=128)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    subject: str = Field(min_length=1, max_length=128)
    year: int = Field(ge=1900, le=2100)
    professor: str | None = Field(default=None, max_length=200)


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
    course_id: str
    question: str = Field(min_length=1)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    created_at: datetime


class ChatThread(BaseModel):
    chat_id: str
    course_id: str
    question: str
    answer: str
    created_at: datetime
    updated_at: datetime
    messages: list[ChatMessage]


class ChatCreateResponse(ChatThread):
    pass
