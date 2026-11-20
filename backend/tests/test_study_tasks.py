import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.dependencies import get_current_user
from src.api.v1.study_tasks import router
from src.db.base import Base
from src.db.models import User
from src.db.session import get_db


class TestStudyTasks(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.user_id = 1

        def database():
            with self.sessions() as db:
                yield db

        def current_user():
            with self.sessions() as db:
                return db.get(User, self.user_id)

        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        app.dependency_overrides[get_db] = database
        app.dependency_overrides[get_current_user] = current_user
        self.client = TestClient(app)
        with self.sessions() as db:
            db.add_all(
                [
                    User(
                        user_id=user_id,
                        user_first_name="Test",
                        user_last_name="User",
                        user_email=f"{user_id}@example.com",
                        password_hash="hash",
                    )
                    for user_id in (1, 2)
                ]
            )
            db.commit()
        self.base = "/api/v1/study-tasks"
        self.payload = {
            "id": "task-0001",
            "title": "  Research paper  ",
            "dueDate": "2026-11-20",
            "course": "ENG 201",
            "completed": False,
            "importance": "high",
            "kind": "academic",
            "quadrant": "schedule",
            "quadrantOverride": None,
            "estimatedHours": 6,
            "estimatedPomodoros": 4,
            "completedPomodoros": 1,
            "dependsOn": [],
            "recurrence": "none",
            "lastPomodoroSessionId": None,
            "updatedAt": "2026-11-17T22:00:00+00:00",
        }

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def test_create_update_list_settings_and_delete(self):
        response = self.client.get(self.base)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json(), {
            "tasks": [],
            "autoPrioritizationEnabled": True,
        })

        created = self.client.post(self.base, json=self.payload)
        self.assertEqual(created.status_code, 201, created.text)
        self.assertEqual(created.json()["title"], "Research paper")
        self.assertEqual(created.json()["dueDate"], "2026-11-20")

        updated_payload = {
            **created.json(),
            "completedPomodoros": 2,
            "quadrant": "do-first",
            "quadrantOverride": "do-first",
        }
        updated = self.client.put(
            f"{self.base}/{self.payload['id']}",
            json=updated_payload,
        )
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["completedPomodoros"], 2)
        self.assertEqual(self.client.get(self.base).json()["tasks"][0]["quadrant"], "do-first")

        settings = self.client.put(
            f"{self.base}/settings",
            json={"autoPrioritizationEnabled": False},
        )
        self.assertEqual(settings.status_code, 200)
        self.assertFalse(
            self.client.get(self.base).json()["autoPrioritizationEnabled"]
        )

        self.assertEqual(
            self.client.delete(f"{self.base}/{self.payload['id']}").status_code,
            204,
        )
        self.assertEqual(self.client.get(self.base).json()["tasks"], [])

    def test_put_creates_a_new_client_generated_task(self):
        response = self.client.put(
            f"{self.base}/{self.payload['id']}",
            json=self.payload,
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["id"], self.payload["id"])
        self.assertEqual(len(self.client.get(self.base).json()["tasks"]), 1)

    def test_task_ownership_and_dependency_validation(self):
        created = self.client.post(self.base, json=self.payload)
        self.assertEqual(created.status_code, 201, created.text)

        self.user_id = 2
        self.assertEqual(self.client.get(self.base).json()["tasks"], [])
        foreign_update = self.client.put(
            f"{self.base}/{self.payload['id']}",
            json=created.json(),
        )
        self.assertEqual(foreign_update.status_code, 409)
        self.assertEqual(
            self.client.delete(f"{self.base}/{self.payload['id']}").status_code,
            404,
        )

        other_task = self.client.post(
            self.base,
            json={**self.payload, "id": "task-0002"},
        )
        self.assertEqual(other_task.status_code, 201, other_task.text)
        self.user_id = 1
        invalid_dependency = {
            **created.json(),
            "id": "task-0003",
            "dependsOn": ["task-0002"],
        }
        self.assertEqual(
            self.client.post(self.base, json=invalid_dependency).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                self.base,
                json={**created.json(), "id": "task-0003", "dependsOn": ["task-0003"]},
            ).status_code,
            400,
        )

    def test_invalid_task_data_is_rejected(self):
        self.assertEqual(
            self.client.post(self.base, json={**self.payload, "title": "   "}).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(self.base, json={**self.payload, "dueDate": "2026-02-31"}).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(self.base, json={**self.payload, "importance": "urgent"}).status_code,
            422,
        )


if __name__ == "__main__":
    unittest.main()
