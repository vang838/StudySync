from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ChatConversationRecord(Base):
    __tablename__ = "chat_conversations"

    conversation_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow,
    )

    turns: Mapped[list["ChatConversationTurnRecord"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatConversationTurnRecord.id",
    )


class ChatConversationTurnRecord(Base):
    __tablename__ = "chat_conversation_turns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("chat_conversations.conversation_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chat_id: Mapped[str] = mapped_column(
        ForeignKey("chat_threads.chat_id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    conversation: Mapped["ChatConversationRecord"] = relationship(
        back_populates="turns",
    )
    chat: Mapped["ChatThreadRecord"] = relationship("ChatThreadRecord")
