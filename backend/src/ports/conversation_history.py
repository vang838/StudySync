from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class ConversationTurn:
    question: str
    answer: str


class ConversationHistoryPort(Protocol):
    """Provide access to prior turns within a user's conversation."""

    def get_recent_turns(self, *, conversation_id: str, user_id: int, limit: int = 8) -> list[ConversationTurn]:
        """Return the most recent turns in chronological order."""
        ...
