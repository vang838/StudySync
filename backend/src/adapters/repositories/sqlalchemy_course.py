from sqlalchemy.orm import Session

from src.db.models import Course
from src.ports.course_repository import CourseMetadata, CourseRepositoryPort


class SQLAlchemyCourseRepositoryAdapter(CourseRepositoryPort):
    def __init__(self, db: Session) -> None:
        self._db = db

    def get_by_id(self, course_id: str) -> CourseMetadata | None:
        course_id = course_id.strip()
        if not course_id: return None

        course = self._db.get(Course, course_id)
        if course is None: return None

        return CourseMetadata(
            course_id=course.course_id,
            title=course.title,
            description=course.description,
            subject=course.subject,
            professor=course.professor,
            year=course.year,
        )
