from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from src.db.models import Course, ProfessorReview, User
from src.db.session import get_db
from src.schemas.contracts import ProfessorReviewCreateRequest

router = APIRouter(prefix="/professor-reviews", tags=["professor-reviews"])


def _serialize_review(review: ProfessorReview) -> dict:
    author = getattr(review, "author", None)
    return {
        "review_id": review.review_id,
        "professor": review.professor,
        "course_id": review.course_id,
        "user_id": getattr(review, "user_id", None),
        "author_name": (
            f"{author.user_first_name} {author.user_last_name}".strip()
            if author is not None
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


def _serialize_course(course: Course) -> dict:
    return {
        "course_id": course.course_id,
        "title": course.title,
        "subject": course.subject,
        "year": course.year,
        "professor": course.professor,
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

    query = db.query(ProfessorReview)
    if hasattr(ProfessorReview, "author"):
        query = query.options(joinedload(ProfessorReview.author))
    query = query.filter(ProfessorReview.professor == professor)
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

    if not hasattr(ProfessorReview, "user_id"):
        return []

    query = db.query(ProfessorReview)
    if hasattr(ProfessorReview, "author"):
        query = query.options(joinedload(ProfessorReview.author))
    reviews = (
        query
        .filter(ProfessorReview.user_id == user_id)
        .order_by(ProfessorReview.created_at.desc())
        .all()
    )
    return [_serialize_review(review) for review in reviews]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_professor_review(
    payload: ProfessorReviewCreateRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Creates a professor review associated with its course and optional author."""
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

    user_id: int | None = payload.user_id
    if user_id is not None:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User '{user_id}' not found.",
            )

    duplicate_query = db.query(ProfessorReview).filter(
        ProfessorReview.professor == professor,
        ProfessorReview.course_id == course.course_id,
    )
    if user_id is not None and hasattr(ProfessorReview, "user_id"):
        duplicate_query = duplicate_query.filter(ProfessorReview.user_id == user_id)
    existing_review = duplicate_query.first()
    if existing_review is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A matching professor review already exists.",
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
        rating=payload.rating,
        feedback=feedback,
    )
    if user_id is not None and hasattr(review, "user_id"):
        setattr(review, "user_id", user_id)
    db.add(review)

        user_id=user.user_id,
        rating=payload.rating,
        feedback=feedback,
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create professor review due to a conflict.",
        ) from error
    db.refresh(review)
    return _serialize_review(review)


@router.get("/search")
def search_professors(
    q: str = Query(..., min_length=1, description="Professor name query"),
    rating: int | None = Query(None, ge=1, le=5, description="Optional rating filter"),
    course_id: str | None = Query(None, description="Optional course filter"),
    page: int = Query(1, ge=1, description="1-based page number"),
    per_page: int = Query(24, ge=1, le=100, description="Results per page"),
    db: Session = Depends(get_db),
) -> dict:
    normalized_query = q.strip()
    normalized_course_id = course_id.strip() if course_id else None

    professors_query = (
        db.query(Course.professor)
        .filter(
            Course.professor.is_not(None),
            Course.professor != "",
            Course.professor.ilike(f"%{normalized_query}%"),
        )
    )

    if normalized_course_id:
        professors_query = professors_query.filter(Course.course_id == normalized_course_id)

    if rating is not None:
        review_match_conditions = [
            ProfessorReview.professor == Course.professor,
            ProfessorReview.rating == rating,
        ]
        if normalized_course_id:
            review_match_conditions.append(ProfessorReview.course_id == normalized_course_id)
        professors_query = professors_query.filter(
            exists().where(and_(*review_match_conditions))
        )

    distinct_professors_query = professors_query.distinct()
    total_count = distinct_professors_query.count()
    total_pages = max(1, (total_count + per_page - 1) // per_page)

    paged_professor_rows = (
        distinct_professors_query
        .order_by(Course.professor.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    professor_names = [row[0] for row in paged_professor_rows if row[0]]

    if not professor_names:
        return {
            "professors": [],
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
        }

    course_rows = (
        db.query(Course)
        .filter(Course.professor.in_(professor_names))
        .order_by(Course.professor.asc(), Course.course_id.asc())
        .all()
    )

    reviews_query = db.query(ProfessorReview).filter(ProfessorReview.professor.in_(professor_names))
    if rating is not None:
        reviews_query = reviews_query.filter(ProfessorReview.rating == rating)
    if normalized_course_id:
        reviews_query = reviews_query.filter(ProfessorReview.course_id == normalized_course_id)
    review_rows = reviews_query.order_by(ProfessorReview.created_at.desc()).all()

    courses_by_professor: dict[str, list[dict]] = {name: [] for name in professor_names}
    for course in course_rows:
        if not course.professor:
            continue
        courses_by_professor[course.professor].append(_serialize_course(course))

    deduped_courses_by_professor: dict[str, list[dict]] = {}
    for professor_name, courses in courses_by_professor.items():
        seen_course_ids: set[str] = set()
        deduped: list[dict] = []
        for course in courses:
            if course["course_id"] in seen_course_ids:
                continue
            seen_course_ids.add(course["course_id"])
            deduped.append(course)
        deduped_courses_by_professor[professor_name] = deduped

    reviews_by_professor: dict[str, list[dict]] = {name: [] for name in professor_names}
    for review in review_rows:
        reviews_by_professor[review.professor].append(_serialize_review(review))

    professors = [
        {
            "name": professor_name,
            "courses": deduped_courses_by_professor.get(professor_name, []),
            "reviews": reviews_by_professor.get(professor_name, []),
        }
        for professor_name in professor_names
    ]

    return {
        "professors": professors,
        "total_count": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }
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
