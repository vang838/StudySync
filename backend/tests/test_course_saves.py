import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.db.base import Base
from src.db.models import Course, User
from src.db.session import get_db


class TestCourseSaveAPI(unittest.TestCase):

    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        Base.metadata.create_all(self.engine)

        self.session_factory = sessionmaker(
            bind=self.engine,
            expire_on_commit=False,
        )

        def override_db():
            with self.session_factory() as db:
                yield db

        app.dependency_overrides[get_db] = override_db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_save_course_and_prevent_duplicates(self):
        with self.session_factory() as db:
            db.add(
                User(
                    user_first_name="Ada",
                    user_last_name="Lovelace",
                    user_email="ada@example.com",
                    password_hash="hashed-password",
                )
            )
            db.add(
                Course(
                    course_id="CS101",
                    title="Intro to Computer Science",
                    description="Foundations of programming.",
                    subject="Computer Science",
                    year=2025,
                    professor="Dr. Reed",
                )
            )
            db.add(
                Course(
                    course_id="MATH201",
                    title="Linear Algebra",
                    description="Matrices and vector spaces.",
                    subject="Mathematics",
                    year=2025,
                    professor="Dr. Patel",
                )
            )
            db.commit()

        response = self.client.post("/api/v1/courses/CS101/save?user_id=1")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["saved"])

        duplicate_response = self.client.post("/api/v1/courses/CS101/save?user_id=1")
        self.assertEqual(duplicate_response.status_code, 200)
        self.assertEqual(
            duplicate_response.json()["message"],
            "Course is already saved for this user.",
        )

        saved_response = self.client.get("/api/v1/courses/saved?user_id=1")
        self.assertEqual(saved_response.status_code, 200)
        self.assertEqual(len(saved_response.json()), 1)
        self.assertEqual(saved_response.json()[0]["course_id"], "CS101")

        saved_only_search_response = self.client.get("/api/v1/courses/search?savedOnly=true&user_id=1")
        self.assertEqual(saved_only_search_response.status_code, 200)
        self.assertEqual(len(saved_only_search_response.json()), 1)
        self.assertEqual(saved_only_search_response.json()[0]["course_id"], "CS101")

        missing_user_saved_only = self.client.get("/api/v1/courses/search?savedOnly=true")
        self.assertEqual(missing_user_saved_only.status_code, 422)

        unsave_response = self.client.delete("/api/v1/courses/CS101/save?user_id=1")
        self.assertEqual(unsave_response.status_code, 200)
        self.assertFalse(unsave_response.json()["saved"])

    def test_subjects_endpoint_is_distinct_and_sorted(self):
        with self.session_factory() as db:
            db.add(
                Course(
                    course_id="CS101",
                    title="Intro to Computer Science",
                    description="Foundations of programming.",
                    subject="Computer Science",
                    year=2025,
                    professor="Dr. Reed",
                )
            )
            db.add(
                Course(
                    course_id="CS201",
                    title="Data Structures",
                    description="Arrays, trees, and graphs.",
                    subject="Computer Science",
                    year=2025,
                    professor="Dr. Reed",
                )
            )
            db.add(
                Course(
                    course_id="BIO101",
                    title="Biology Basics",
                    description="Introduction to biology.",
                    subject="Biology",
                    year=2025,
                    professor="Dr. Moss",
                )
            )
            db.commit()

        response = self.client.get("/api/v1/courses/subjects")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), ["Biology", "Computer Science"])

    def test_course_forum_thread_crud_permissions(self):
        with self.session_factory() as db:
            db.add(
                User(
                    user_first_name="Ada",
                    user_last_name="Lovelace",
                    user_email="ada@example.com",
                    password_hash="hashed-password",
                )
            )
            db.add(
                User(
                    user_first_name="Grace",
                    user_last_name="Hopper",
                    user_email="grace@example.com",
                    password_hash="hashed-password",
                )
            )
            db.add(
                Course(
                    course_id="CS101",
                    title="Intro to Computer Science",
                    description="Foundations of programming.",
                    subject="Computer Science",
                    year=2025,
                    professor="Dr. Reed",
                )
            )
            db.commit()

        self.client.post("/api/v1/courses/CS101/save?user_id=1")
        self.client.post("/api/v1/courses/CS101/save?user_id=2")

        root_post_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={
                "user_id": 1,
                "content": "Can someone explain dynamic programming?",
            },
        )
        self.assertEqual(root_post_response.status_code, 200)
        root_post_id = root_post_response.json()["post_id"]

        reply_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={
                "user_id": 2,
                "content": "Sure, think memoization + optimal substructure.",
                "parent_post_id": root_post_id,
            },
        )
        self.assertEqual(reply_response.status_code, 200)
        reply_post_id = reply_response.json()["post_id"]

        thread_response = self.client.get("/api/v1/courses/CS101/forum/posts")
        self.assertEqual(thread_response.status_code, 200)
        thread_data = thread_response.json()
        self.assertEqual(len(thread_data), 1)
        self.assertEqual(thread_data[0]["post_id"], root_post_id)
        self.assertEqual(len(thread_data[0]["replies"]), 1)
        self.assertEqual(thread_data[0]["replies"][0]["post_id"], reply_post_id)

        focused_thread_response = self.client.get(f"/api/v1/courses/CS101/forum/posts/{root_post_id}")
        self.assertEqual(focused_thread_response.status_code, 200)
        focused_thread_data = focused_thread_response.json()
        self.assertEqual(focused_thread_data["post_id"], root_post_id)
        self.assertEqual(len(focused_thread_data["replies"]), 1)
        self.assertEqual(focused_thread_data["replies"][0]["post_id"], reply_post_id)

        forbidden_edit = self.client.put(
            f"/api/v1/courses/CS101/forum/posts/{root_post_id}",
            json={"user_id": 2, "content": "Hijacking your post"},
        )
        self.assertEqual(forbidden_edit.status_code, 403)

        allowed_edit = self.client.put(
            f"/api/v1/courses/CS101/forum/posts/{root_post_id}",
            json={"user_id": 1, "content": "Updated question with more context"},
        )
        self.assertEqual(allowed_edit.status_code, 200)
        self.assertEqual(allowed_edit.json()["content"], "Updated question with more context")

        forbidden_delete = self.client.delete(f"/api/v1/courses/CS101/forum/posts/{root_post_id}?user_id=2")
        self.assertEqual(forbidden_delete.status_code, 403)

        allowed_delete = self.client.delete(f"/api/v1/courses/CS101/forum/posts/{root_post_id}?user_id=1")
        self.assertEqual(allowed_delete.status_code, 200)

        empty_thread_response = self.client.get("/api/v1/courses/CS101/forum/posts")
        self.assertEqual(empty_thread_response.status_code, 200)
        self.assertEqual(empty_thread_response.json(), [])


if __name__ == "__main__":
    unittest.main()
