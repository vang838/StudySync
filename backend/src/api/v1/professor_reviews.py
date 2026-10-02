from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.db.models import ProfessorReview
from src.db.session import get_db

router = APIRouter(prefix="/professor-reviews", tags=["professor-reviews"])


def _serialize_review(review: ProfessorReview) -> dict:
    return {
        "review_id": review.review_id,
        "professor": review.professor,
        "course_id": review.course_id,
        "rating": review.rating,
        "feedback": review.feedback,
        "created_at": review.created_at,
    }


@router.get("")
def get_professor_reviews(
    professor: str = Query(..., description="Professor name"),
    rating: int | None = Query(None, ge=1, le=5, description="Filter by rating"),
    course_id: str | None = Query(None, description="Filter by course"),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Returns reviews for a professor with optional rating and course filters."""

    query = db.query(ProfessorReview).filter(
        ProfessorReview.professor == professor
    )

    if rating is not None:
        query = query.filter(ProfessorReview.rating == rating)

    if course_id:
        query = query.filter(ProfessorReview.course_id == course_id)

    reviews = query.order_by(ProfessorReview.created_at.desc()).all()

    return [_serialize_review(review) for review in reviews]