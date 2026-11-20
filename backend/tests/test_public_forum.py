import unittest
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.core.security import create_session_token
from src.db.base import Base
from src.db.models import Course, CourseForumPost, User, UserCourseSave
from src.db.session import get_db
from src.main import app


class TestPublicForum(unittest.TestCase):
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

        now = datetime.now(timezone.utc)

        with self.session_factory() as db:
            db.add_all([
                User(user_id=1, user_first_name="Ada", user_last_name="Lovelace",
                     user_email="ada@example.com", password_hash="test-hash"),
                User(user_id=2, user_first_name="Grace", user_last_name="Hopper",
                     user_email="grace@example.com", password_hash="test-hash"),
                Course(course_id="CS101", title="Computer Science",
                       subject="Computer Science", year=2026),
                UserCourseSave(user_id=1, course_id="CS101"),
            ])
            db.commit()

            db.add_all([
                CourseForumPost(post_id=1, course_id="CS101", user_id=1,
                                content="Older discussion", created_at=now - timedelta(days=10)),
                CourseForumPost(post_id=2, course_id="CS101", user_id=1,
                                content="Newer discussion", created_at=now - timedelta(days=3)),
            ])
            db.commit()

            db.add(
                CourseForumPost(post_id=3, course_id="CS101", user_id=2,
                                parent_post_id=1, content="Recent reply",
                                created_at=now - timedelta(days=1))
            )
            db.commit()

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def test_guest_can_read_recent_discussions(self):
        response = self.client.get("/api/v1/forum/recent")
        self.assertEqual(response.status_code, 200)

        discussions = response.json()
        self.assertEqual(len(discussions), 2)
        self.assertEqual(discussions[0]["post_id"], 1)
        self.assertEqual(discussions[0]["reply_count"], 1)
        self.assertEqual(discussions[0]["course_title"], "Computer Science")
        self.assertNotIn("user_id", discussions[0])
        self.assertNotIn("email", discussions[0])

    def test_guest_can_read_forum_posts(self):
        response = self.client.get("/api/v1/courses/CS101/forum/posts")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)

        response = self.client.get("/api/v1/courses/CS101/forum/posts/1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["content"], "Older discussion")

    def test_guest_cannot_access_personalized_forum_state(self):
        response = self.client.get("/api/v1/courses/CS101/forum/posts?user_id=1")
        self.assertEqual(response.status_code, 403)

        response = self.client.get("/api/v1/courses/CS101/forum/posts/1?user_id=1")
        self.assertEqual(response.status_code, 403)

    def test_guest_cannot_contribute(self):
        requests = [
            ("POST", "/api/v1/courses/CS101/forum/posts",
             {"user_id": 1, "content": "Guest post"}),
            ("PUT", "/api/v1/courses/CS101/forum/posts/1",
             {"user_id": 1, "content": "Edited"}),
            ("DELETE", "/api/v1/courses/CS101/forum/posts/1?user_id=1", None),
            ("POST", "/api/v1/courses/CS101/forum/posts/1/like?user_id=1", None),
            ("DELETE", "/api/v1/courses/CS101/forum/posts/1/like?user_id=1", None),
            ("POST", "/api/v1/courses/CS101/forum/posts/1/bookmark?user_id=1", None),
            ("DELETE", "/api/v1/courses/CS101/forum/posts/1/bookmark?user_id=1", None),
        ]

        for method, url, payload in requests:
            with self.subTest(method=method, url=url):
                response = self.client.request(method, url, json=payload)
                self.assertEqual(response.status_code, 401)

    def test_authenticated_user_cannot_impersonate_another_user(self):
        self.client.cookies.set("studysync_session", create_session_token(2))

        response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={"user_id": 1, "content": "Impersonated post"},
        )
        self.assertEqual(response.status_code, 403)

        response = self.client.get("/api/v1/courses/CS101/forum/posts?user_id=1")
        self.assertEqual(response.status_code, 403)

    def test_authenticated_course_member_can_post(self):
        self.client.cookies.set("studysync_session", create_session_token(1))

        response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={"user_id": 1, "content": "Authenticated post"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["content"], "Authenticated post")

    def test_authenticated_nonmember_cannot_post(self):
        self.client.cookies.set("studysync_session", create_session_token(2))

        response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={"user_id": 2, "content": "Nonmember post"},
        )
        self.assertEqual(response.status_code, 403)

    def test_session_lookup(self):
        response = self.client.get("/api/v1/auth/me")
        self.assertEqual(response.status_code, 401)

        self.client.cookies.set("studysync_session", create_session_token(1))
        response = self.client.get("/api/v1/auth/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"user_id": 1})


if __name__ == "__main__":
    unittest.main()
