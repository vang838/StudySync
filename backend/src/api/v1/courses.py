from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.db.models import Course
from src.db.session import get_db
from src.schemas.contracts import CourseCreateRequest

router = APIRouter(prefix="/courses", tags=["courses"])


def _serialize_course(course: Course) -> dict:
    return {
        "course_id": course.course_id,
        "title": course.title,
        "description": course.description,
        "professor": course.professor,
        "subject": course.subject,
        "year": course.year,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }

def _search_courses(db: Session, filters: dict) -> List[dict]:
    """Queries the database for courses matching the given filters."""
    query = db.query(Course)
    
    # Apply filters dynamically using SQLAlchemy query methods
    if filters.get("subject"):
        query = query.filter(Course.subject.ilike(f"%{filters['subject']}%"))
    if filters.get("courseNumber"):
        query = query.filter(Course.course_id.ilike(f"%{filters['courseNumber']}%"))
    if filters.get("name"):
        # NOTE: Changed to Course.title based on common database schema patterns
        query = query.filter(Course.title.ilike(f"%{filters['name']}%"))
    if filters.get("professor"):
        query = query.filter(Course.professor.ilike(f"%{filters['professor']}%"))
        
    courses = query.all()
    return [_serialize_course(course) for course in courses]


@router.get("/search")
def search_courses(
    db: Session = Depends(get_db),
    subject: str | None = Query(None, description="Filter by subject (e.g., Computer Science)"),
    courseNumber: str | None = Query(None, description="Filter by course number (e.g., CS101)"),
    name: str | None = Query(None, description="Search by course name (partial match)"),
    professor: str | None = Query(None, description="Filter by professor/instructor name")
) -> List[dict]:
    """
    Searches the course catalog by querying the database.
    The database session is managed by FastAPI's dependency injection system.
    """
    search_filters = {}
    # Use the passed arguments directly; they are either None or the search term.
    if subject:
        search_filters["subject"] = subject
    if courseNumber:
        search_filters["courseNumber"] = courseNumber
    if name:
        search_filters["name"] = name
    if professor:
        search_filters["professor"] = professor
        
    return _search_courses(db, search_filters)


@router.get("/{course_id}")
def get_course(course_id: str, db: Session = Depends(get_db)) -> dict:
    """Retrieves a single course by its unique ID from the database."""
    # Assuming course_id matches Course.course_id
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found in the database.",
        )
    return _serialize_course(course)

@router.get("")
def list_courses():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Listing all courses endpoint is deprecated. Please use /search instead.",
    )

@router.post("")
def create_course(payload: CourseCreateRequest, db: Session = Depends(get_db)) -> dict:
    normalized_course_id = payload.course_id.strip()
    if not normalized_course_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="course_id cannot be blank.",
        )

    existing = db.query(Course).filter(Course.course_id == normalized_course_id).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course '{normalized_course_id}' already exists.",
        )

    created = Course(
        course_id=normalized_course_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        subject=payload.subject.strip(),
        year=payload.year,
        professor=payload.professor.strip() if payload.professor else None,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return _serialize_course(created)