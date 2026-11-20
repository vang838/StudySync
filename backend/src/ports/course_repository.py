from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class CourseMetadata:
    course_id: str
    title: str
    description: str | None
    subject: str
    professor: str | None
    year: int


class CourseRepositoryPort(Protocol):
    def get_by_id(self, course_id: str) -> CourseMetadata | None:
        """Return authoritative course metadata, or None if not found."""
        ...
