import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.db.base import Base
from src.db.models import Course, ProfessorReview
from src.db.session import get_db


class TestProfessorSearchAPI(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

        def override_db():
            with self.session_factory() as db:
                yield db

        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_professor_search_returns_paginated_professors_with_courses_and_reviews(self):
        with self.session_factory() as db:
            db.add_all(
                [
                    Course(
                        course_id="DAC 699",
                        title="Studio Practice",
                        description="",
                        professor="Alex Doe",
                        subject="DAC",
                        year=2026,
                    ),
                    Course(
                        course_id="DAC 500",
                        title="Capstone",
                        description="",
                        professor="Alex Doe",
                        subject="DAC",
                        year=2026,
                    ),
                    Course(
                        course_id="MUS 101",
                        title="Intro Music",
                        description="",
                        professor="Amy Dean",
                        subject="MUS",
                        year=2026,
                    ),
                    ProfessorReview(
                        professor="Alex Doe",
                        course_id="DAC 699",
                        rating=5,
                        feedback="Great class",
                    ),
                    ProfessorReview(
                        professor="Amy Dean",
                        course_id="MUS 101",
                        rating=3,
                        feedback="Okay class",
                    ),
                ]
            )
            db.commit()

        response = self.client.get("/api/v1/professor-reviews/search?q=A&page=1&per_page=1")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["page"], 1)
        self.assertEqual(payload["per_page"], 1)
        self.assertEqual(payload["total_count"], 2)
        self.assertEqual(payload["total_pages"], 2)
        self.assertEqual(len(payload["professors"]), 1)
        self.assertEqual(payload["professors"][0]["name"], "Alex Doe")
        self.assertEqual(len(payload["professors"][0]["courses"]), 2)
        self.assertEqual(len(payload["professors"][0]["reviews"]), 1)

        filtered = self.client.get(
            "/api/v1/professor-reviews/search?q=A&rating=5&course_id=DAC%20699&page=1&per_page=24"
        )
        self.assertEqual(filtered.status_code, 200)
        filtered_payload = filtered.json()
        self.assertEqual(filtered_payload["total_count"], 1)
        self.assertEqual(filtered_payload["professors"][0]["name"], "Alex Doe")


if __name__ == "__main__":
    unittest.main()
