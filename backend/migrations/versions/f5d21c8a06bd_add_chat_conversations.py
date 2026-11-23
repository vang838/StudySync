"""Add user-owned conversations and chat turn associations.

Revision ID: f5d21c8a06bd
Revises: b4a1f7c92d60
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5d21c8a06bd"
down_revision: Union[str, Sequence[str], None] = "b4a1f7c92d60"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if not inspector.has_table("chat_conversations"):
        op.create_table(
            "chat_conversations",
            sa.Column("conversation_id", sa.String(32), primary_key=True),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("course_id", sa.String(128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["user_id"], ["users.user_id"], ondelete="CASCADE",
            ),
        )

    if not inspector.has_table("chat_conversation_turns"):
        op.create_table(
            "chat_conversation_turns",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("conversation_id", sa.String(32), nullable=False),
            sa.Column("chat_id", sa.String(32), nullable=False),
            sa.ForeignKeyConstraint(
                ["conversation_id"],
                ["chat_conversations.conversation_id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(
                ["chat_id"], ["chat_threads.chat_id"], ondelete="CASCADE",
            ),
            sa.UniqueConstraint(
                "chat_id", name="uq_chat_conversation_turns_chat_id",
            ),
        )

    conversation_indexes = {
        item["name"]
        for item in sa.inspect(op.get_bind()).get_indexes("chat_conversations")
    }
    if "ix_chat_conversations_user_id" not in conversation_indexes:
        op.create_index(
            "ix_chat_conversations_user_id", "chat_conversations", ["user_id"],
        )

    turn_indexes = {
        item["name"]
        for item in sa.inspect(op.get_bind()).get_indexes("chat_conversation_turns")
    }
    if "ix_chat_conversation_turns_conversation_id" not in turn_indexes:
        op.create_index(
            "ix_chat_conversation_turns_conversation_id",
            "chat_conversation_turns",
            ["conversation_id"],
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    if inspector.has_table("chat_conversation_turns"):
        indexes = {
            item["name"]
            for item in inspector.get_indexes("chat_conversation_turns")
        }
        if "ix_chat_conversation_turns_conversation_id" in indexes:
            op.drop_index(
                "ix_chat_conversation_turns_conversation_id",
                table_name="chat_conversation_turns",
            )
        op.drop_table("chat_conversation_turns")

    if inspector.has_table("chat_conversations"):
        indexes = {
            item["name"]
            for item in inspector.get_indexes("chat_conversations")
        }
        if "ix_chat_conversations_user_id" in indexes:
            op.drop_index(
                "ix_chat_conversations_user_id",
                table_name="chat_conversations",
            )
        op.drop_table("chat_conversations")
