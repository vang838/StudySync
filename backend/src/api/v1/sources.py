from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import TypeAdapter
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.chat_evidence_models import ChatEvidenceAssessmentRecord
from src.db.session import get_db
from src.schemas.retrieval import Citation

router = APIRouter(prefix="/sources", tags=["sources"])
_citation_adapter = TypeAdapter(Citation)


@router.get("/{source_id}", response_model=Citation)
def get_source(source_id: str, db: Session = Depends(get_db)) -> Citation:
    assessments = db.scalars(select(ChatEvidenceAssessmentRecord)).all()

    for assessment in assessments:
        for citation in assessment.citations:
            if citation.get("evidence_id") == source_id:
                return _citation_adapter.validate_python(citation)

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Source '{source_id}' was not found.",
    )
