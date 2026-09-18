import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.db.models import ChatMessageRecord, ChatThreadRecord
from src.db.session import get_db
from src.schemas.contracts import ChatCreateRequest, ChatCreateResponse, ChatMessage, ChatThread
from src.api.dependencies import get_chat_service
from src.application.chat_service import ChatService
from src.ports.llm import (
    LLMResponseError,
    LLMUnavailableError,
)

router = APIRouter(prefix="/chat", tags=["chat"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

def _thread_to_schema(thread: ChatThreadRecord) -> ChatThread:
    return ChatThread(
        chat_id=thread.chat_id,
        course_id=thread.course_id,
        question=thread.question,
        answer=thread.answer,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        messages=[
            ChatMessage(role=message.role, content=message.content, created_at=message.created_at)
            for message in thread.messages
        ],
    )


@router.post("", response_model=ChatCreateResponse, status_code=status.HTTP_201_CREATED)
def create_chat(payload: ChatCreateRequest, db: Session = Depends(get_db), chat_service: ChatService = Depends(get_chat_service),) -> ChatCreateResponse:
    try:
        answer = chat_service.generate_ans(question=payload.question)

    except LLMUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI inference service is unavailable.",) from exc

    except LLMResponseError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="AI inference returned an error")

    now = _utcnow()
    chat_id = uuid4().hex

    thread = ChatThreadRecord(
        chat_id=chat_id,
        course_id=payload.course_id,
        question=payload.question,
        answer=answer,
        created_at=now,
        updated_at=now,
        messages = [
            ChatMessageRecord(
                role="user",
                content=payload.question,
                created_at=now,
            ),
            ChatMessageRecord(
                role="assistant",
                content=answer,
                created_at=now,
            )
        ],
    )

    db.add(thread)
    db.commit()
    db.refresh(thread)
    return ChatCreateResponse(**_thread_to_schema(thread).model_dump())

@router.get("/{chat_id}", response_model=ChatThread)
def get_chat(chat_id: str, db: Session = Depends(get_db)) -> ChatThread:
    statement = (
        select(ChatThreadRecord)
        .options(selectinload(ChatThreadRecord.messages))
        .where(ChatThreadRecord.chat_id == chat_id)
    )
    thread = db.scalar(statement)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat '{chat_id}' was not found.",
        )
    return _thread_to_schema(thread)


@router.get("/{chat_id}/stream")
async def stream_chat(chat_id: str, db: Session = Depends(get_db)) -> StreamingResponse:
    statement = (
        select(ChatThreadRecord)
        .options(selectinload(ChatThreadRecord.messages))
        .where(ChatThreadRecord.chat_id == chat_id)
    )
    thread = db.scalar(statement)
    if thread is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat '{chat_id}' was not found.",
        )

    async def event_stream() -> AsyncGenerator[str, None]:
        for token in thread.answer.split():
            yield f"event: token\ndata: {token}\n\n"
            await asyncio.sleep(0.02)
        yield f"event: done\ndata: {chat_id}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")