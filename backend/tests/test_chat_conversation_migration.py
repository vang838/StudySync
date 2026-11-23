from importlib import import_module
from unittest import TestCase
from unittest.mock import patch

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


migration = import_module(
    "migrations.versions.f5d21c8a06bd_add_chat_conversations"
)


class TestChatConversationMigration(TestCase):
    def setUp(self):
        self.engine = sa.create_engine("sqlite+pysqlite:///:memory:")
        self.connection = self.engine.connect()

        metadata = sa.MetaData()
        sa.Table(
            "users", metadata,
            sa.Column("user_id", sa.Integer(), primary_key=True),
        )
        sa.Table(
            "chat_threads", metadata,
            sa.Column("chat_id", sa.String(32), primary_key=True),
        )
        metadata.create_all(self.connection)

        self.operations = Operations(MigrationContext.configure(self.connection))

    def tearDown(self):
        self.connection.close()
        self.engine.dispose()

    def upgrade(self):
        with patch.object(migration, "op", self.operations):
            migration.upgrade()

    def test_upgrade_creates_conversation_tables(self):
        self.upgrade()
        inspector = sa.inspect(self.connection)

        self.assertTrue(inspector.has_table("chat_conversations"))
        self.assertTrue(inspector.has_table("chat_conversation_turns"))

        conversation_indexes = {
            item["name"]
            for item in inspector.get_indexes("chat_conversations")
        }
        turn_indexes = {
            item["name"]
            for item in inspector.get_indexes("chat_conversation_turns")
        }
        turn_constraints = {
            item["name"]
            for item in inspector.get_unique_constraints("chat_conversation_turns")
        }

        self.assertIn("ix_chat_conversations_user_id", conversation_indexes)
        self.assertIn(
            "ix_chat_conversation_turns_conversation_id", turn_indexes,
        )
        self.assertIn(
            "uq_chat_conversation_turns_chat_id", turn_constraints,
        )

    def test_upgrade_can_run_again(self):
        self.upgrade()
        self.upgrade()

        inspector = sa.inspect(self.connection)
        self.assertTrue(inspector.has_table("chat_conversations"))
        self.assertTrue(inspector.has_table("chat_conversation_turns"))

    def test_downgrade_removes_conversation_tables(self):
        self.upgrade()

        with patch.object(migration, "op", self.operations):
            migration.downgrade()

        inspector = sa.inspect(self.connection)
        self.assertFalse(inspector.has_table("chat_conversations"))
        self.assertFalse(inspector.has_table("chat_conversation_turns"))
