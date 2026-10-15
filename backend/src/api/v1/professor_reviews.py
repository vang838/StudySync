from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from src.db.models import Course, ProfessorReview, User
from src.db.session import get_db
from src.schemas.contracts import ProfessorReviewCreateRequest

router = APIRouter(prefix="/professor-reviews", tags=["professor-reviews"])


def _serialize_review(review: ProfessorReview) -> dict:
    return {
        "review_id": review.review_id,
        "professor": review.professor,
        "course_id": review.course_id,
        "user_id": review.user_id,
        "author_name": (
            f"{review.author.user_first_name} {review.author.user_last_name}".strip()
            if review.author
            else None
        ),
        "rating": review.rating,
        "feedback": review.feedback,
        "created_at": review.created_at,
    }


@router.get("/users/{user_id}")
def get_user_professor_reviews(
    user_id: int,
    db: Session = Depends(get_db),
) -> list[dict]:
    """Returns professor reviews authored by a user."""
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )

    reviews = (
        db.query(ProfessorReview)
        .options(joinedload(ProfessorReview.author))
        .filter(ProfessorReview.user_id == user_id)
        .order_by(ProfessorReview.created_at.desc())
        .all()
    )
    return [_serialize_review(review) for review in reviews]


@router.get("")
def get_professor_reviews(
    professor: str = Query(..., description="Professor name"),
    rating: int | None = Query(None, ge=1, le=5, description="Filter by rating"),
    course_id: str | None = Query(None, description="Filter by course"),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Returns reviews for a professor with optional rating and course filters."""

    query = (
        db.query(ProfessorReview)
        .options(joinedload(ProfessorReview.author))
        .filter(ProfessorReview.professor == professor)
    )

    if rating is not None:
        query = query.filter(ProfessorReview.rating == rating)

    if course_id:
        query = query.filter(ProfessorReview.course_id == course_id)

    reviews = query.order_by(ProfessorReview.created_at.desc()).all()

    return [_serialize_review(review) for review in reviews]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_professor_review(
    payload: ProfessorReviewCreateRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Creates a professor review associated with its course and author."""
    professor = payload.professor.strip()
    feedback = payload.feedback.strip()
    if not professor or not feedback:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Professor and feedback must not be blank.",
        )

    user = db.get(User, payload.user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{payload.user_id}' not found.",
        )

    course = db.get(Course, payload.course_id)
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{payload.course_id}' not found.",
        )
    if course.professor != professor:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected course is not taught by this professor.",
        )

    existing_review = db.scalar(
        select(ProfessorReview.review_id).where(
            ProfessorReview.user_id == user.user_id,
            ProfessorReview.professor == professor,
            ProfessorReview.course_id == course.course_id,
        )
    )
    if existing_review is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reviewed this professor for this course.",
        )

    review = ProfessorReview(
        professor=professor,
        course_id=course.course_id,
        user_id=user.user_id,
        rating=payload.rating,
        feedback=feedback,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        duplicate_review = db.scalar(
            select(ProfessorReview.review_id).where(
                ProfessorReview.user_id == user.user_id,
                ProfessorReview.professor == professor,
                ProfessorReview.course_id == course.course_id,
            )
        )
        if duplicate_review is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already reviewed this professor for this course.",
            ) from error
        raise
    db.refresh(review)
    return _serialize_review(review)