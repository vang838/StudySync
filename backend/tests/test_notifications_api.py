import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.dependencies import get_current_user
from src.core.security import hash_password
from src.db.base import Base
from src.db.models import (
    Course,
    DocumentOwnerRecord,
    DocumentPublicationRecord,
    DocumentRecord,
    Notification,
    NotificationPreference,
    User,
    UserCourseSave,
)
from src.db.session import get_db
from src.main import app


class TestNotificationsAPI(unittest.TestCase):

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

        with self.session_factory() as db:
            self.user = User(
                user_first_name="Ada",
                user_last_name="Lovelace",
                user_email="ada@example.com",
                password_hash=hash_password("password123"),
            )
            db.add(self.user)
            db.commit()
            db.refresh(self.user)
            user_id = self.user.user_id

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = lambda: self._load_user(user_id)
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()
        self.engine.dispose()

    def _load_user(self, user_id: int) -> User:
        with self.session_factory() as db:
            user = db.get(User, user_id)
            db.expunge(user)
            return user

    def test_notification_preferences_default_and_update(self):
        response = self.client.get("/api/v1/notifications/preferences")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["forum_replies"])
        self.assertTrue(response.json()["course_file_uploads"])
        self.assertTrue(response.json()["saved_course_posts"])

        response = self.client.put(
            "/api/v1/notifications/preferences",
            json={
                "forum_replies": False,
                "study_tasks": True,
                "study_materials": False,
                "challenges": True,
                "course_file_uploads": False,
                "saved_course_posts": True,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["forum_replies"])
        self.assertFalse(response.json()["study_materials"])
        self.assertFalse(response.json()["course_file_uploads"])

    def test_create_list_and_mark_notification_read(self):
        response = self.client.post(
            "/api/v1/notifications",
            json={
                "type": "study_task",
                "title": "Study task due today",
                "message": "Review notes is due today.",
                "link": "/dashboard",
            },
        )
        self.assertEqual(response.status_code, 200)
        notification_id = response.json()["notification_id"]

        response = self.client.get("/api/v1/notifications")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["notification_id"], notification_id)
        self.assertFalse(response.json()[0]["is_read"])

        response = self.client.post(f"/api/v1/notifications/{notification_id}/read")
        self.assertEqual(response.status_code, 200)

        with self.session_factory() as db:
            notification = db.scalar(select(Notification).where(Notification.notification_id == notification_id))
            preference = db.scalar(
                select(NotificationPreference).where(NotificationPreference.user_id == self.user.user_id)
            )
            self.assertTrue(notification.is_read)
            self.assertIsNotNone(preference)

    def test_delete_notification(self):
        with self.session_factory() as db:
            notification = Notification(
                user_id=self.user.user_id,
                type="challenge_completed",
                title="Challenge completed",
                message="You completed a challenge.",
                link="/dashboard",
            )
            db.add(notification)
            db.commit()
            db.refresh(notification)
            notification_id = notification.notification_id

        response = self.client.delete(f"/api/v1/notifications/{notification_id}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["deleted"])

        with self.session_factory() as db:
            notification = db.get(Notification, notification_id)
            self.assertIsNone(notification)

    def test_forum_reply_notification_contains_reply_preview(self):
        with self.session_factory() as db:
            replying_user = User(
                user_first_name="Grace",
                user_last_name="Hopper",
                user_email="grace@example.com",
                password_hash=hash_password("password123"),
            )
            db.add(replying_user)
            db.add(Course(
                course_id="CS101",
                title="Intro to Computer Science",
                description="Foundations of programming.",
                subject="Computer Science",
                year=2025,
            ))
            db.commit()
            db.refresh(replying_user)
            replying_user_id = replying_user.user_id

        self.client.post("/api/v1/courses/CS101/save?user_id=1")
        self.client.post(f"/api/v1/courses/CS101/save?user_id={replying_user_id}")

        root_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={"user_id": self.user.user_id, "content": "Can someone explain dynamic programming?"},
        )
        self.assertEqual(root_response.status_code, 200)
        root_post_id = root_response.json()["post_id"]

        reply_text = "Sure, think memoization and optimal substructure."
        reply_response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={
                "user_id": replying_user_id,
                "content": reply_text,
                "parent_post_id": root_post_id,
            },
        )
        self.assertEqual(reply_response.status_code, 200)

        with self.session_factory() as db:
            notification = db.scalar(
                select(Notification).where(
                    Notification.user_id == self.user.user_id,
                    Notification.type == "forum_reply",
                )
            )
            self.assertIsNotNone(notification)
            self.assertIn(reply_text, notification.message)
            self.assertTrue(notification.title.startswith("New reply to Post: "))

    def test_published_course_file_notification_only_on_publish(self):
        with self.session_factory() as db:
            member = User(
                user_first_name="Grace",
                user_last_name="Hopper",
                user_email="member@example.com",
                password_hash=hash_password("password123"),
            )
            db.add(member)
            db.add(Course(
                course_id="CS101",
                title="Intro to Computer Science",
                description="Foundations of programming.",
                subject="Computer Science",
                year=2025,
            ))
            db.commit()
            db.refresh(member)
            member_id = member.user_id
            db.add(UserCourseSave(user_id=member_id, course_id="CS101", is_archived=False))
            document = DocumentRecord(
                document_id="private-document",
                course_id="CS101",
                title="Lecture Notes",
                is_published=False,
            )
            db.add(document)
            db.flush()
            db.add(DocumentOwnerRecord(
                document_id=document.document_id,
                user_id=self.user.user_id,
            ))
            db.commit()

        unpublish_response = self.client.patch(
            "/api/v1/documents/private-document/publish",
            json={"is_published": False},
        )
        self.assertEqual(unpublish_response.status_code, 200)

        with self.session_factory() as db:
            count = db.query(Notification).filter(
                Notification.type == "course_file_upload",
                Notification.user_id == member_id,
            ).count()
            self.assertEqual(count, 0)

        publish_response = self.client.patch(
            "/api/v1/documents/private-document/publish",
            json={"is_published": True},
        )
        self.assertEqual(publish_response.status_code, 200)

        with self.session_factory() as db:
            notification = db.scalar(
                select(Notification).where(
                    Notification.type == "course_file_upload",
                    Notification.user_id == member_id,
                )
            )
            self.assertIsNotNone(notification)
            self.assertIn("Lecture Notes", notification.message)

    def test_saved_course_post_notification(self):
        with self.session_factory() as db:
            saved_member = User(
                user_first_name="Grace",
                user_last_name="Hopper",
                user_email="saved-member@example.com",
                password_hash=hash_password("password123"),
            )
            db.add(saved_member)
            db.add(Course(
                course_id="CS101",
                title="Intro to Computer Science",
                description="Foundations of programming.",
                subject="Computer Science",
                year=2025,
            ))
            db.commit()
            db.refresh(saved_member)
            saved_member_id = saved_member.user_id

        self.client.post("/api/v1/courses/CS101/save?user_id=1")
        self.client.post(f"/api/v1/courses/CS101/save?user_id={saved_member_id}")

        response = self.client.post(
            "/api/v1/courses/CS101/forum/posts",
            json={"user_id": 1, "content": "A new study question for everyone."},
        )
        self.assertEqual(response.status_code, 200)

        with self.session_factory() as db:
            notification = db.scalar(
                select(Notification).where(
                    Notification.user_id == saved_member_id,
                    Notification.type == "saved_course_post",
                )
            )
            self.assertIsNotNone(notification)
            self.assertTrue(notification.title.startswith("New post in CS101: "))
            self.assertIn("A new study question", notification.message)


if __name__ == "__main__":
    unittest.main()
