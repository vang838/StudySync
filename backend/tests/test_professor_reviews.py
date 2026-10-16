import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.db.base import Base
from src.db.models import Course, ProfessorReview, User
from src.db.session import get_db
from src.main import app


class TestProfessorReviewAPI(unittest.TestCase):
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

        with self.session_factory() as db:
            db.add_all(
                [
                    User(
                        user_first_name="Ada",
                        user_last_name="Lovelace",
                        user_email="ada@example.com",
                        password_hash="hashed-password",
                    ),
                    User(
                        user_first_name="Grace",
                        user_last_name="Hopper",
                        user_email="grace@example.com",
                        password_hash="hashed-password",
                    ),
                    Course(
                        course_id="CS101",
                        title="Intro to Computer Science",
                        subject="Computer Science",
                        year=2025,
                        professor="Dr. Reed",
                    ),
                    Course(
                        course_id="MATH201",
                        title="Linear Algebra",
                        subject="Mathematics",
                        year=2025,
                        professor="Dr. Patel",
                    ),
                ]
            )
            db.commit()

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_create_list_by_professor_and_list_by_user(self):
        response = self.client.post(
            "/api/v1/professor-reviews",
            json={
                "professor": "Dr. Reed",
                "course_id": "CS101",
                "user_id": 1,
                "rating": 5,
                "feedback": "Clear and helpful.",
            },
        )

        self.assertEqual(response.status_code, 201)
        created_review = response.json()
        self.assertEqual(created_review["author_name"], "Ada Lovelace")
        self.assertEqual(created_review["user_id"], 1)

        professor_response = self.client.get(
            "/api/v1/professor-reviews",
            params={"professor": "Dr. Reed"},
        )
        self.assertEqual(professor_response.status_code, 200)
        self.assertEqual(len(professor_response.json()), 1)
        self.assertEqual(professor_response.json()[0]["feedback"], "Clear and helpful.")

        user_response = self.client.get("/api/v1/professor-reviews/users/1")
        self.assertEqual(user_response.status_code, 200)
        self.assertEqual(len(user_response.json()), 1)
        self.assertEqual(user_response.json()[0]["professor"], "Dr. Reed")

    def test_create_rejects_invalid_rating_and_course_professor_mismatch(self):
        invalid_rating = self.client.post(
            "/api/v1/professor-reviews",
            json={
                "professor": "Dr. Reed",
                "course_id": "CS101",
                "user_id": 1,
                "rating": 6,
                "feedback": "Too high.",
            },
        )
        self.assertEqual(invalid_rating.status_code, 422)

        mismatch = self.client.post(
            "/api/v1/professor-reviews",
            json={
                "professor": "Dr. Reed",
                "course_id": "MATH201",
                "user_id": 1,
                "rating": 4,
                "feedback": "Wrong course.",
            },
        )
        self.assertEqual(mismatch.status_code, 422)

    def test_user_can_review_professor_once_per_course(self):
        review_payload = {
            "professor": "Dr. Reed",
            "course_id": "CS101",
            "user_id": 1,
            "rating": 5,
            "feedback": "Clear and helpful.",
        }

        first_response = self.client.post(
            "/api/v1/professor-reviews",
            json=review_payload,
        )
        duplicate_response = self.client.post(
            "/api/v1/professor-reviews",
            json={**review_payload, "feedback": "A second review."},
        )
        different_user_response = self.client.post(
            "/api/v1/professor-reviews",
            json={**review_payload, "user_id": 2},
        )

        self.assertEqual(first_response.status_code, 201)
        self.assertEqual(duplicate_response.status_code, 409)
        self.assertIn("already reviewed", duplicate_response.json()["detail"])
        self.assertEqual(different_user_response.status_code, 201)

    def test_review_can_be_created_and_listed_with_existing_author_relationship(self):
        with self.session_factory() as db:
            db.add(
                ProfessorReview(
                    professor="Dr. Reed",
                    course_id="CS101",
                    user_id=2,
                    rating=4,
                    feedback="Thoughtful feedback.",
                )
            )
            db.add(
                ProfessorReview(
                    professor="Dr. Reed",
                    course_id="CS101",
                    user_id=None,
                    rating=3,
                    feedback="Legacy anonymous review.",
                )
            )
            db.commit()

        professor_response = self.client.get(
            "/api/v1/professor-reviews",
            params={"professor": "Dr. Reed"},
        )
        reviews = professor_response.json()
        self.assertEqual(len(reviews), 2)
        self.assertEqual(
            {review["author_name"] for review in reviews},
            {"Grace Hopper", None},
        )

        user_response = self.client.get("/api/v1/professor-reviews/users/2")
        self.assertEqual(len(user_response.json()), 1)
        self.assertEqual(user_response.json()[0]["author_name"], "Grace Hopper")
