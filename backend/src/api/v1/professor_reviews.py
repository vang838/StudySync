from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, exists
from sqlalchemy.orm import Session

from src.db.models import Course, ProfessorReview
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


def _serialize_course(course: Course) -> dict:
    return {
        "course_id": course.course_id,
        "title": course.title,
        "subject": course.subject,
        "year": course.year,
        "professor": course.professor,
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