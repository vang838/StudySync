from unittest import TestCase

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.adapters.repositories.sqlalchemy_course import SQLAlchemyCourseRepositoryAdapter
from src.db.base import Base
from src.db.models import Course
from src.ports.course_repository import CourseMetadata


class TestCourseRepository(TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.repository = SQLAlchemyCourseRepositoryAdapter(self.db)

        self.db.add(Course(
            course_id="FILM 220",
            title="16mm Filmmaking",
            description="3 cr. Post-foundation studio in 16mm film production.",
            subject="FILM",
            professor="S. Drake",
            year=2026,
        ))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_retrieves_authoritative_course_metadata(self):
        result = self.repository.get_by_id("FILM 220")

        self.assertEqual(result, CourseMetadata(
            course_id="FILM 220",
            title="16mm Filmmaking",
            description="3 cr. Post-foundation studio in 16mm film production.",
            subject="FILM",
            professor="S. Drake",
            year=2026,
        ))

    def test_normalizes_surrounding_whitespace(self):
        result = self.repository.get_by_id(" FILM 220 ")

        self.assertIsNotNone(result)
        self.assertEqual(result.course_id, "FILM 220")

    def test_returns_none_for_unknown_course(self):
        self.assertIsNone(self.repository.get_by_id("UNKNOWN 999"))

    def test_returns_none_for_empty_course_id(self):
        self.assertIsNone(self.repository.get_by_id("   "))
