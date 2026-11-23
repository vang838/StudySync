from datetime import datetime

from pydantic import BaseModel

from src.schemas.contracts import ChatThread


class ChatConversationListItem(BaseModel):
    conversation_id: str
    course_id: str | None
    title: str
    updated_at: datetime


class ChatConversationListResponse(BaseModel):
    items: list[ChatConversationListItem]
    has_more: bool


class ChatConversationResponse(BaseModel):
    conversation_id: str
    course_id: str | None
    turns: list[ChatThread]
