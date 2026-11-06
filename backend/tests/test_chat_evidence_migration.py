from datetime import datetime, timezone
from importlib import import_module
from unittest import TestCase
from unittest.mock import patch

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, select

from src.db.base import Base
from src.db.chat_evidence_models import ChatEvidenceAssessmentRecord
from src.db.models import ChatThreadRecord


migration = import_module("migrations.versions.e6b2a1c4d8f0_add_chat_evidence_assessments")


class TestChatEvidenceMigration(TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        self.connection = self.engine.connect()
        ChatThreadRecord.__table__.create(self.connection)
        self.operations = Operations(MigrationContext.configure(self.connection))

    def tearDown(self):
        self.connection.close()
        self.engine.dispose()

    def upgrade(self):
        with patch.object(migration, "op", self.operations):
            migration.upgrade()

    def assert_unique_chat_index(self):
        indexes = inspect(self.connection).get_indexes("chat_evidence_assessments")
        index = next(item for item in indexes if item["name"] == "ix_chat_evidence_assessments_chat_id")
        self.assertTrue(index["unique"])
        self.assertEqual(index["column_names"], ["chat_id"])

    def test_creates_table_when_application_has_not_started(self):
        self.upgrade()

        self.assertTrue(inspect(self.connection).has_table("chat_evidence_assessments"))
        self.assert_unique_chat_index()

    def test_adopts_startup_created_table_and_preserves_records(self):
        Base.metadata.create_all(self.connection)
        now = datetime.now(timezone.utc)
        self.connection.execute(ChatThreadRecord.__table__.insert().values(
            chat_id="chat-1", question="Question", answer="Answer",
            created_at=now, updated_at=now,
        ))
        assessment = ChatEvidenceAssessmentRecord.__table__
        self.connection.execute(assessment.insert().values(
            chat_id="chat-1", mode="course", evidence_status="sufficient",
            citations=[{"evidence_id": "internal:chunk-1"}], claims=[], created_at=now,
        ))
        before = self.connection.execute(select(assessment)).mappings().all()

        self.upgrade()

        self.assertEqual(self.connection.execute(select(assessment)).mappings().all(), before)
        self.assert_unique_chat_index()

    def test_adds_missing_index_to_existing_table(self):
        Base.metadata.create_all(self.connection)
        self.operations.drop_index(
            "ix_chat_evidence_assessments_chat_id", table_name="chat_evidence_assessments",
        )

        self.upgrade()

        self.assert_unique_chat_index()

    def test_upgrade_can_run_again_without_duplicate_table_or_index(self):
        self.upgrade()
        self.upgrade()

        self.assert_unique_chat_index()
