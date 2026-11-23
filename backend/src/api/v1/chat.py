import asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.api.dependencies import (
    get_assistant_service,
    get_conversation_history_repository,
    get_current_user,
)
from src.application.assistant_service import AssistantService
from src.db.chat_conversation_models import ChatConversationRecord, ChatConversationTurnRecord
from src.db.chat_evidence_models import ChatEvidenceAssessmentRecord
from src.db.models import ChatMessageRecord, ChatThreadRecord, User
from src.db.session import get_db
from src.ports.conversation_history import ConversationHistoryPort
from src.ports.llm import LLMResponseError, LLMUnavailableError
from src.schemas.chat_history import ChatConversationListItem, ChatConversationListResponse, ChatConversationResponse
from src.schemas.contracts import ChatCreateRequest, ChatCreateResponse, ChatMessage, ChatThread

router = APIRouter(prefix="/chat", tags=["chat"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_owned_chat(db: Session, user_id: int, chat_id: str) -> tuple[ChatThreadRecord, str]:
    statement = (
        select(ChatThreadRecord, ChatConversationTurnRecord.conversation_id)
        .join(ChatConversationTurnRecord, ChatConversationTurnRecord.chat_id == ChatThreadRecord.chat_id)
        .join(ChatConversationRecord, ChatConversationRecord.conversation_id == ChatConversationTurnRecord.conversation_id)
        .options(selectinload(ChatThreadRecord.messages))
        .where(ChatThreadRecord.chat_id == chat_id, ChatConversationRecord.user_id == user_id)
    )
    row = db.execute(statement).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found.")
    return row[0], row[1]


def _thread_to_schema(
    thread: ChatThreadRecord,
    assessment: ChatEvidenceAssessmentRecord | None,
    conversation_id: str,
) -> ChatThread:
    if assessment is None:
        mode = "course" if thread.course_id else "general"
        evidence_status = "not_applicable"
        citations = []
        claims = []
    else:
        mode = assessment.mode
        evidence_status = assessment.evidence_status
        citations = assessment.citations
        claims = assessment.claims

    return ChatThread(
        chat_id=thread.chat_id,
        conversation_id=conversation_id,
        course_id=thread.course_id,
        question=thread.question,
        answer=thread.answer,
        created_at=thread.created_at,
        updated_at=thread.updated_at,
        messages=[
            ChatMessage(role=message.role, content=message.content, created_at=message.created_at)
            for message in thread.messages
        ],
        mode=mode,
        evidence_status=evidence_status,
        citations=citations,
        claims=claims,
    )


@router.post("", response_model=ChatCreateResponse, status_code=status.HTTP_201_CREATED)
def create_chat(
    payload: ChatCreateRequest,
    db: Session = Depends(get_db),
    assistant_service: AssistantService = Depends(get_assistant_service),
    current_user: User = Depends(get_current_user),
    history_repository: ConversationHistoryPort = Depends(get_conversation_history_repository),
) -> ChatCreateResponse:
    course_id = payload.course_id.strip() if payload.course_id else None
    course_id = course_id or None

    conversation = None
    if payload.conversation_id:
        conversation = db.scalar(
            select(ChatConversationRecord).where(
                ChatConversationRecord.conversation_id == payload.conversation_id,
                ChatConversationRecord.user_id == current_user.user_id,
            )
        )
        if conversation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")
        if conversation.course_id != course_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="The selected course does not match this conversation.",
            )

    history = (
        history_repository.get_recent_turns(
            conversation_id=conversation.conversation_id,
            user_id=current_user.user_id,
        )
        if conversation is not None else []
    )

    try:
        result = assistant_service.generate(
            question=payload.question,
            course_id=course_id,
            hint_level=payload.hint_level,
            history=history,
        )
    except LLMUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI inference service is unavailable.",
        ) from exc
    except LLMResponseError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI inference returned an error",
        ) from exc

    now = _utcnow()
    chat_id = uuid4().hex

    try:
        if conversation is None:
            conversation = ChatConversationRecord(
                conversation_id=uuid4().hex,
                user_id=current_user.user_id,
                course_id=course_id,
                created_at=now,
                updated_at=now,
            )
            db.add(conversation)
            db.flush()
        else:
            conversation.updated_at = now

        thread = ChatThreadRecord(
            chat_id=chat_id,
            course_id=course_id,
            question=payload.question,
            answer=result.answer,
            created_at=now,
            updated_at=now,
            messages=[
                ChatMessageRecord(role="user", content=payload.question, created_at=now),
                ChatMessageRecord(role="assistant", content=result.answer, created_at=now),
            ],
        )
        assessment = ChatEvidenceAssessmentRecord(
            chat_id=chat_id,
            mode=result.mode,
            evidence_status=result.evidence_status,
            citations=[citation.model_dump(mode="json") for citation in result.citations],
            claims=[claim.model_dump(mode="json") for claim in result.claims],
            created_at=now,
        )

        db.add(thread)
        db.flush()
        db.add(ChatConversationTurnRecord(
            conversation_id=conversation.conversation_id,
            chat_id=chat_id,
        ))
        db.add(assessment)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(thread)
    db.refresh(assessment)

    return ChatCreateResponse.model_validate(
        _thread_to_schema(thread, assessment, conversation.conversation_id).model_dump()
    )


@router.get("/conversations", response_model=ChatConversationListResponse)
def list_conversations(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatConversationListResponse:
    first_question = (
        select(ChatThreadRecord.question)
        .join(ChatConversationTurnRecord, ChatConversationTurnRecord.chat_id == ChatThreadRecord.chat_id)
        .where(ChatConversationTurnRecord.conversation_id == ChatConversationRecord.conversation_id)
        .order_by(ChatConversationTurnRecord.id)
        .limit(1)
        .scalar_subquery()
    )
    statement = (
        select(ChatConversationRecord, first_question.label("title"))
        .where(ChatConversationRecord.user_id == current_user.user_id)
        .order_by(ChatConversationRecord.updated_at.desc(), ChatConversationRecord.conversation_id.desc())
        .offset(offset)
        .limit(limit + 1)
    )
    rows = db.execute(statement).all()
    return ChatConversationListResponse(
        items=[
            ChatConversationListItem(
                conversation_id=conversation.conversation_id,
                course_id=conversation.course_id,
                title=title or "New conversation",
                updated_at=conversation.updated_at,
            )
            for conversation, title in rows[:limit]
        ],
        has_more=len(rows) > limit,
    )


@router.get("/conversations/{conversation_id}", response_model=ChatConversationResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatConversationResponse:
    conversation = db.scalar(
        select(ChatConversationRecord).where(
            ChatConversationRecord.conversation_id == conversation_id,
            ChatConversationRecord.user_id == current_user.user_id,
        )
    )
    if conversation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found.")

    statement = (
        select(ChatThreadRecord, ChatEvidenceAssessmentRecord)
        .join(ChatConversationTurnRecord, ChatConversationTurnRecord.chat_id == ChatThreadRecord.chat_id)
        .outerjoin(ChatEvidenceAssessmentRecord, ChatEvidenceAssessmentRecord.chat_id == ChatThreadRecord.chat_id)
        .options(selectinload(ChatThreadRecord.messages))
        .where(ChatConversationTurnRecord.conversation_id == conversation.conversation_id)
        .order_by(ChatConversationTurnRecord.id)
    )
    rows = db.execute(statement).all()
    return ChatConversationResponse(
        conversation_id=conversation.conversation_id,
        course_id=conversation.course_id,
        turns=[_thread_to_schema(thread, assessment, conversation.conversation_id) for thread, assessment in rows],
    )


@router.get("/{chat_id}", response_model=ChatThread)
def get_chat(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatThread:
    thread, conversation_id = _get_owned_chat(db, current_user.user_id, chat_id)
    assessment = db.scalar(
        select(ChatEvidenceAssessmentRecord).where(
            ChatEvidenceAssessmentRecord.chat_id == chat_id
        )
    )
    return _thread_to_schema(thread, assessment, conversation_id)


@router.get("/{chat_id}/stream")
async def stream_chat(
    chat_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    thread, _ = _get_owned_chat(db, current_user.user_id, chat_id)

    async def event_stream() -> AsyncGenerator[str, None]:
        for token in thread.answer.split():
            yield f"event: token\ndata: {token}\n\n"
            await asyncio.sleep(0.02)
        yield f"event: done\ndata: {chat_id}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
