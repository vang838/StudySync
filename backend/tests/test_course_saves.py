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
        saved_only_payload = saved_only_search_response.json()
        self.assertEqual(saved_only_payload["total_count"], 1)
        self.assertEqual(saved_only_payload["page"], 1)
        self.assertEqual(saved_only_payload["per_page"], 24)
        self.assertEqual(len(saved_only_payload["courses"]), 1)
        self.assertEqual(saved_only_payload["courses"][0]["course_id"], "CS101")

        year_filtered_response = self.client.get("/api/v1/courses/search?year=2025")
        self.assertEqual(year_filtered_response.status_code, 200)
        year_filtered_payload = year_filtered_response.json()
        self.assertEqual(year_filtered_payload["total_count"], 2)
        self.assertTrue(all(course["year"] == 2025 for course in year_filtered_payload["courses"]))

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
                    year=2026,
                    professor="Dr. Moss",
                )
            )
            db.commit()

        response = self.client.get("/api/v1/courses/subjects")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), ["Biology", "Computer Science"])

        years_response = self.client.get("/api/v1/courses/years")
        self.assertEqual(years_response.status_code, 200)
        self.assertEqual(years_response.json(), [2026, 2025])

    def test_course_members_and_user_profile_endpoints(self):
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

        self.client.post("/api/v1/courses/CS101/save?user_id=2")
        self.client.post("/api/v1/courses/CS101/save?user_id=1")

        members_response = self.client.get("/api/v1/courses/CS101/members")
        self.assertEqual(members_response.status_code, 200)
        members = members_response.json()
        self.assertEqual([member["full_name"] for member in members], ["Ada Lovelace", "Grace Hopper"])

        profile_response = self.client.get("/api/v1/users/1")
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.json()["full_name"], "Ada Lovelace")
        self.assertEqual(profile_response.json()["forum_points"], 0)
        self.assertEqual(profile_response.json()["forum_point_values"]["post_or_reply"], 10)
        self.assertEqual(profile_response.json()["forum_point_values"]["like_received"], 5)

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
        self.assertEqual(thread_data[0]["reply_count"], 1)
        self.assertFalse(thread_data[0]["is_bookmarked"])
        self.assertEqual(thread_data[0]["like_count"], 0)
        self.assertFalse(thread_data[0]["is_liked"])
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

        # Forum points are currency balances and should remain after post deletion.
        user_one_points_response = self.client.get("/api/v1/users/1")
        self.assertEqual(user_one_points_response.status_code, 200)
        self.assertEqual(user_one_points_response.json()["forum_points"], 10)
        user_two_points_response = self.client.get("/api/v1/users/2")
        self.assertEqual(user_two_points_response.status_code, 200)
        self.assertEqual(user_two_points_response.json()["forum_points"], 10)

        empty_thread_response = self.client.get("/api/v1/courses/CS101/forum/posts")
        self.assertEqual(empty_thread_response.status_code, 200)
        self.assertEqual(empty_thread_response.json(), [])

    def test_course_forum_search_filter_bookmark_and_sort(self):
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

        dynamic_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={
                "user_id": 1,
                "content": "Need help with dynamic programming strategy",
            },
        )
        self.assertEqual(dynamic_response.status_code, 200)
        dynamic_post_id = dynamic_response.json()["post_id"]

        graph_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={
                "user_id": 2,
                "content": "Graph traversal tips for DFS vs BFS?",
            },
        )
        self.assertEqual(graph_response.status_code, 200)
        graph_post_id = graph_response.json()["post_id"]

        reply_one_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={
                "user_id": 2,
                "content": "Try memoization and a state table.",
                "parent_post_id": dynamic_post_id,
            },
        )
        self.assertEqual(reply_one_response.status_code, 200)

        reply_two_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={
                "user_id": 1,
                "content": "Also write recurrence first.",
                "parent_post_id": dynamic_post_id,
            },
        )
        self.assertEqual(reply_two_response.status_code, 200)

        bookmark_response = self.client.post(
            f"/api/v1/courses/CS101/forum/posts/{dynamic_post_id}/bookmark?user_id=1",
        )
        self.assertEqual(bookmark_response.status_code, 200)
        self.assertTrue(bookmark_response.json()["bookmarked"])

        like_response = self.client.post(
            f"/api/v1/courses/CS101/forum/posts/{dynamic_post_id}/like?user_id=2",
        )
        self.assertEqual(like_response.status_code, 200)
        self.assertTrue(like_response.json()["liked"])
        self.assertEqual(like_response.json()["like_count"], 1)

        search_response = self.client.get(
            "/api/v1/courses/CS101/forum/posts?q=dynamic&user_id=1&sort=newest",
        )
        self.assertEqual(search_response.status_code, 200)
        search_data = search_response.json()
        self.assertEqual(len(search_data), 1)
        self.assertEqual(search_data[0]["post_id"], dynamic_post_id)

        mine_filter_response = self.client.get(
            "/api/v1/courses/CS101/forum/posts?author_user_id=2&user_id=1&sort=newest",
        )
        self.assertEqual(mine_filter_response.status_code, 200)
        mine_data = mine_filter_response.json()
        self.assertEqual(len(mine_data), 1)
        self.assertEqual(mine_data[0]["post_id"], graph_post_id)

        bookmarked_only_response = self.client.get(
            "/api/v1/courses/CS101/forum/posts?bookmarked_only=true&user_id=1&sort=newest",
        )
        self.assertEqual(bookmarked_only_response.status_code, 200)
        bookmarked_data = bookmarked_only_response.json()
        self.assertEqual(len(bookmarked_data), 1)
        self.assertEqual(bookmarked_data[0]["post_id"], dynamic_post_id)
        self.assertTrue(bookmarked_data[0]["is_bookmarked"])
        self.assertEqual(bookmarked_data[0]["like_count"], 1)
        self.assertFalse(bookmarked_data[0]["is_liked"])

        popular_sort_response = self.client.get(
            "/api/v1/courses/CS101/forum/posts?sort=popular&user_id=1",
        )
        self.assertEqual(popular_sort_response.status_code, 200)
        popular_data = popular_sort_response.json()
        self.assertEqual(popular_data[0]["post_id"], dynamic_post_id)
        self.assertEqual(popular_data[0]["reply_count"], 2)

        focused_response = self.client.get(
            f"/api/v1/courses/CS101/forum/posts/{dynamic_post_id}?user_id=1",
        )
        self.assertEqual(focused_response.status_code, 200)
        self.assertTrue(focused_response.json()["is_bookmarked"])
        self.assertEqual(focused_response.json()["like_count"], 1)
        self.assertFalse(focused_response.json()["is_liked"])

        liked_points_response = self.client.get("/api/v1/users/1")
        self.assertEqual(liked_points_response.status_code, 200)
        # User 1 wrote two posts/replies (+20) and has one received like (+5).
        self.assertEqual(liked_points_response.json()["forum_points"], 25)

        missing_user_bookmark_filter = self.client.get(
            "/api/v1/courses/CS101/forum/posts?bookmarked_only=true",
        )
        self.assertEqual(missing_user_bookmark_filter.status_code, 422)

        unbookmark_response = self.client.delete(
            f"/api/v1/courses/CS101/forum/posts/{dynamic_post_id}/bookmark?user_id=1",
        )
        self.assertEqual(unbookmark_response.status_code, 200)
        self.assertFalse(unbookmark_response.json()["bookmarked"])

        unlike_response = self.client.delete(
            f"/api/v1/courses/CS101/forum/posts/{dynamic_post_id}/like?user_id=2",
        )
        self.assertEqual(unlike_response.status_code, 200)
        self.assertFalse(unlike_response.json()["liked"])
        self.assertEqual(unlike_response.json()["like_count"], 0)

        user_points_response = self.client.get("/api/v1/users/1")
        self.assertEqual(user_points_response.status_code, 200)
        # User 1 wrote two posts/replies (+20); the removed like no longer contributes points.
        self.assertEqual(user_points_response.json()["forum_points"], 20)


if __name__ == "__main__":
    unittest.main()
