from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import TypeAdapter
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.dependencies import get_current_user
from src.db.chat_conversation_models import ChatConversationRecord, ChatConversationTurnRecord
from src.db.chat_evidence_models import ChatEvidenceAssessmentRecord
from src.db.models import User
from src.db.session import get_db
from src.schemas.retrieval import Citation

router = APIRouter(prefix="/sources", tags=["sources"])
_citation_adapter = TypeAdapter(Citation)


@router.get("/{source_id}", response_model=Citation)
def get_source(source_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Citation:
    statement = (
        select(ChatEvidenceAssessmentRecord)
        .join(ChatConversationTurnRecord, ChatConversationTurnRecord.chat_id == ChatEvidenceAssessmentRecord.chat_id)
        .join(ChatConversationRecord, ChatConversationRecord.conversation_id == ChatConversationTurnRecord.conversation_id)
        .where(ChatConversationRecord.user_id == current_user.user_id)
        .order_by(ChatEvidenceAssessmentRecord.id.desc())
    )

    for assessment in db.scalars(statement):
        for citation in assessment.citations:
            if citation.get("evidence_id") == source_id:
                return _citation_adapter.validate_python(citation)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Source '{source_id}' was not found.",
    )
