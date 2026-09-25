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


class CourseCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class DocumentUploadRequest(BaseModel):
    course_id: str
    title: str = Field(min_length=1, max_length=200)
    source_url: str | None = None


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
