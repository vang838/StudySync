import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, inspect, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.api.v1.flashcards import router
from src.db.base import Base
from src.db.models import Course, User, UserCourseSave, FlashcardStudyProgress
from src.db.session import get_db


class TestFlashcards(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        @event.listens_for(self.engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False)
        def database():
            with self.sessions() as db:
                yield db
        app = FastAPI()
        app.include_router(router, prefix="/api/v1")
        app.dependency_overrides[get_db] = database
        self.client = TestClient(app)
        with self.sessions() as db:
            db.add_all([User(user_id=i, user_first_name="Test", user_last_name="User", user_email=f"{i}@example.com", password_hash="hash") for i in (1, 2)])
            db.add(Course(course_id="CS101", title="Computer science", description="", subject="CS", year=2026))
            db.commit()
            db.add(UserCourseSave(user_id=1, course_id="CS101", is_archived=False))
            db.commit()
        self.base = "/api/v1/flashcard-sets"
        self.payload = {"course_id": "CS101", "title": " Fundamentals ", "description": "Review", "cards": [{"question": " Q1 ", "answer": " A1 "}, {"question": "Q2", "answer": "A2"}]}

    def tearDown(self):
        self.client.close()
        self.engine.dispose()

    def create(self):
        response = self.client.post(self.base, params={"user_id": 1}, json=self.payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_create_list_course_choices_and_owner_filter(self):
        created = self.create()
        self.assertEqual(created["title"], "Fundamentals")
        self.assertEqual(created["cards"][0]["question"], "Q1")
        self.assertEqual([c["position"] for c in created["cards"]], [0, 1])
        self.assertEqual(len(self.client.get(self.base, params={"user_id": 1}).json()), 1)
        self.assertEqual(self.client.get(self.base, params={"user_id": 2}).json(), [])
        path = f"{self.base}/{created['flashcardsets_id']}"
        for method in ("get", "put", "delete"):
            kwargs = {"json": self.payload} if method == "put" else {}
            self.assertEqual(getattr(self.client, method)(path, params={"user_id": 2}, **kwargs).status_code, 404)
        self.assertEqual(self.client.get(self.base).status_code, 422)
        self.assertEqual(self.client.get(self.base, params={"user_id": 999}).status_code, 404)
        self.assertEqual(len(self.client.get(f"{self.base}/courses", params={"user_id": 1}).json()), 1)
        with self.sessions() as db:
            saved = db.scalar(select(UserCourseSave))
            saved.is_archived = True
            db.commit()
        self.assertEqual(self.client.get(f"{self.base}/courses", params={"user_id": 1}).json(), [])
        self.assertEqual(self.client.post(self.base, params={"user_id": 1}, json=self.payload).status_code, 400)

    def test_reorder_edit_preserves_ratings_and_removal_cascades(self):
        created = self.create()
        path = f"{self.base}/{created['flashcardsets_id']}"
        first, second = created["cards"]
        rating_path = f"{path}/cards/{first['flashcard_id']}/rating"
        for rating in ("hard", "easy"):
            self.assertEqual(self.client.put(rating_path, params={"user_id": 1}, json={"rating": rating}).status_code, 200)
        payload = {**self.payload, "cards": [second, {**first, "answer": "Updated"}, {"question": "Q3", "answer": "A3"}]}
        response = self.client.put(path, params={"user_id": 1}, json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        cards = response.json()["cards"]
        self.assertEqual([c["position"] for c in cards], [0, 1, 2])
        self.assertEqual(cards[0]["flashcard_id"], second["flashcard_id"])
        self.assertEqual(cards[1]["flashcard_id"], first["flashcard_id"])
        with self.sessions() as db:
            progress = db.scalars(select(FlashcardStudyProgress)).all()
            self.assertEqual(len(progress), 1)
            self.assertEqual(progress[0].rating, "easy")
        self.client.put(path, params={"user_id": 1}, json={**self.payload, "cards": [second]})
        with self.sessions() as db:
            self.assertEqual(db.scalars(select(FlashcardStudyProgress)).all(), [])
        self.client.put(f"{path}/cards/{second['flashcard_id']}/rating", params={"user_id": 1}, json={"rating": "practice"})
        self.assertEqual(self.client.delete(path, params={"user_id": 1}).status_code, 204)
        with self.sessions() as db:
            self.assertEqual(db.scalars(select(FlashcardStudyProgress)).all(), [])
        self.assertEqual(self.client.get(path, params={"user_id": 1}).status_code, 404)

    def test_validation_and_foreign_card_ids(self):
        created = self.create()
        path = f"{self.base}/{created['flashcardsets_id']}"
        for change in ({"title": "   "}, {"cards": []}, {"cards": [{"question": "  ", "answer": "A"}]}):
            self.assertEqual(self.client.post(self.base, params={"user_id": 1}, json={**self.payload, **change}).status_code, 422)
        self.assertEqual(self.client.post(self.base, params={"user_id": 2}, json=self.payload).status_code, 400)
        foreign = self.create()["cards"][0]
        for cards in ([foreign], [created["cards"][0]] * 2):
            self.assertEqual(self.client.put(path, params={"user_id": 1}, json={**self.payload, "cards": cards}).status_code, 400)
        self.assertEqual(self.client.put(f"{path}/cards/{foreign['flashcard_id']}/rating", params={"user_id": 1}, json={"rating": "easy"}).status_code, 404)
        self.assertEqual(self.client.put(f"{path}/cards/{created['cards'][0]['flashcard_id']}/rating", params={"user_id": 1}, json={"rating": "invalid"}).status_code, 422)


class TestFlashcardMigration(unittest.TestCase):
    def test_create_all_accepts_existing_flashcard_set_primary_key(self):
        engine = create_engine("sqlite+pysqlite://")
        User.__table__.create(engine)
        Course.__table__.create(engine)
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE flashcard_sets (
                    flashcard_set_id INTEGER PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    course_id VARCHAR(128),
                    title VARCHAR(200) NOT NULL,
                    description TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME NOT NULL
                )
            """))

        Base.metadata.create_all(engine)

        self.assertIn(
            "flashcard_set_id",
            {column["name"] for column in inspect(engine).get_columns("flashcard_sets")},
        )
        self.assertIn("flashcard", inspect(engine).get_table_names())
        engine.dispose()

    def test_upgrade_is_repeatable_and_downgrade_removes_tables(self):
        import importlib.util
        from pathlib import Path
        from alembic.migration import MigrationContext
        from alembic.operations import Operations
        from sqlalchemy import inspect

        path = Path(__file__).parents[1] / "migrations/versions/e5b2c9a7d401_add_flashcards.py"
        spec = importlib.util.spec_from_file_location("flashcard_migration", path)
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        engine = create_engine("sqlite+pysqlite://")
        with engine.begin() as conn:
            User.__table__.create(conn)
            Course.__table__.create(conn)
            with Operations.context(MigrationContext.configure(conn)):
                migration.upgrade()
                migration.upgrade()
                self.assertTrue({"flashcard_sets", "flashcard", "flashcard_study_progress"}.issubset(inspect(conn).get_table_names()))
                self.assertIn("flashcard_set_id", {column["name"] for column in inspect(conn).get_columns("flashcard_sets")})
                migration.downgrade()
                self.assertEqual(set(inspect(conn).get_table_names()), {"users", "courses"})
        engine.dispose()
