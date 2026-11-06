"""add persisted chat evidence assessments

Revision ID: e6b2a1c4d8f0
Revises: 007472f2c72d, d3a1b0f4e6c8
Create Date: 2026-10-29 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6b2a1c4d8f0"
down_revision: Union[str, Sequence[str], None] = (
    "007472f2c72d",
    "d3a1b0f4e6c8",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())

    # Application startup may already have created this table through create_all.
    if not inspector.has_table("chat_evidence_assessments"):
        op.create_table(
            "chat_evidence_assessments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("chat_id", sa.String(length=32), nullable=False),
            sa.Column("mode", sa.String(length=32), nullable=False),
            sa.Column("evidence_status", sa.String(length=32), nullable=False),
            sa.Column("citations", sa.JSON(), nullable=False),
            sa.Column("claims", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["chat_id"], ["chat_threads.chat_id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    index_names = {
        index["name"]
        for index in sa.inspect(op.get_bind()).get_indexes("chat_evidence_assessments")
    }
    if "ix_chat_evidence_assessments_chat_id" not in index_names:
        op.create_index(
            op.f("ix_chat_evidence_assessments_chat_id"),
            "chat_evidence_assessments",
            ["chat_id"],
            unique=True,
        )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_chat_evidence_assessments_chat_id"),
        table_name="chat_evidence_assessments",
    )
    op.drop_table("chat_evidence_assessments")
