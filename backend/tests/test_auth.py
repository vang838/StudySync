import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from src.main import app
from src.db.base import Base
from src.db.models import User
from src.db.session import get_db
from src.core.security import hash_password, verify_password


class TestAuthAPI(unittest.TestCase):

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

    def test_login_success(self):
        with self.session_factory() as db:
            db.add(
                User(
                    user_first_name="Ada",
                    user_last_name="Lovelace",
                    user_email="ada@example.com",
                    password_hash=hash_password("password123"),
                )
            )
            db.commit()

        response = self.client.post(
            "/api/v1/auth/login",
            json={
                "email": "ada@example.com",
                "password": "password123",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Login successful.")

    def test_resetpassword_updates_user_password(self):
        with self.session_factory() as db:
            db.add(
                User(
                    user_first_name="Ada",
                    user_last_name="Lovelace",
                    user_email="ada@example.com",
                    password_hash=hash_password("old-password-123"),
                )
            )
            db.commit()

        response = self.client.post(
            "/api/v1/auth/resetpassword",
            json={
                "email": "ada@example.com",
                "password": "new-password-456",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Password reset successfully.")

        with self.session_factory() as db:
            user = db.scalar(select(User).where(User.user_email == "ada@example.com"))

        self.assertIsNotNone(user)
        self.assertTrue(verify_password("new-password-456", user.password_hash))
        self.assertFalse(verify_password("old-password-123", user.password_hash))

    def test_forgotpassword_returns_generic_success_response(self):
        with self.session_factory() as db:
            db.add(
                User(
                    user_first_name="Ada",
                    user_last_name="Lovelace",
                    user_email="ada@example.com",
                    password_hash=hash_password("password123"),
                )
            )
            db.commit()

        response = self.client.post(
            "/api/v1/auth/forgotpassword",
            json={"email": "ada@example.com"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertIn("If an account exists", response.json()["message"])


if __name__ == "__main__":
    unittest.main()
