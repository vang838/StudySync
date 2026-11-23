from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.chat_conversation_models import ChatConversationRecord, ChatConversationTurnRecord
from src.db.models import ChatThreadRecord
from src.ports.conversation_history import ConversationHistoryPort, ConversationTurn


class SQLAlchemyConversationHistoryAdapter(ConversationHistoryPort):
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_recent_turns(self, *, conversation_id: str, user_id: int, limit: int = 8) -> list[ConversationTurn]:
        if not 1 <= limit <= 8: raise ValueError("limit must be between 1 and 8")

        statement = (
            select(ChatThreadRecord.question, ChatThreadRecord.answer)
            .join(
                ChatConversationTurnRecord,
                ChatConversationTurnRecord.chat_id == ChatThreadRecord.chat_id,
            )
            .join(
                ChatConversationRecord,
                ChatConversationRecord.conversation_id == ChatConversationTurnRecord.conversation_id,
            )
            .where(
                ChatConversationRecord.conversation_id == conversation_id,
                ChatConversationRecord.user_id == user_id,
            )
            .order_by(ChatConversationTurnRecord.id.desc())
            .limit(limit)
        )

        rows = self._db.execute(statement).all()
        return [
            ConversationTurn(question=question, answer=answer)
            for question, answer in reversed(rows)
        ]
