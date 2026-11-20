"""add persisted study planner tasks and preferences

Revision ID: b4a1f7c92d60
Revises: e5b2c9a7d401, e6b2a1c4d8f0
Create Date: 2026-11-17 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b4a1f7c92d60"
down_revision: Union[str, Sequence[str], None] = (
    "e5b2c9a7d401",
    "e6b2a1c4d8f0",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("study_planner_preferences"):
        op.create_table(
            "study_planner_preferences",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column(
                "auto_prioritization_enabled",
                sa.Boolean(),
                server_default=sa.true(),
                nullable=False,
            ),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id"),
        )

    if not inspector.has_table("study_tasks"):
        op.create_table(
            "study_tasks",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=200), nullable=False),
            sa.Column("due_date", sa.String(length=10), server_default="", nullable=False),
            sa.Column("course", sa.String(length=200), server_default="", nullable=False),
            sa.Column("completed", sa.Boolean(), server_default=sa.false(), nullable=False),
            sa.Column("importance", sa.String(length=16), server_default="medium", nullable=False),
            sa.Column("kind", sa.String(length=32), server_default="academic", nullable=False),
            sa.Column("quadrant", sa.String(length=32), server_default="schedule", nullable=False),
            sa.Column("quadrant_override", sa.String(length=32), nullable=True),
            sa.Column("estimated_hours", sa.Float(), server_default="1", nullable=False),
            sa.Column("estimated_pomodoros", sa.Integer(), server_default="1", nullable=False),
            sa.Column("completed_pomodoros", sa.Integer(), server_default="0", nullable=False),
            sa.Column(
                "depends_on",
                sa.JSON(),
                server_default=sa.text("'[]'"),
                nullable=False,
            ),
            sa.Column("recurrence", sa.String(length=16), server_default="none", nullable=False),
            sa.Column("last_pomodoro_session_id", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    index_names = {
        index["name"] for index in sa.inspect(op.get_bind()).get_indexes("study_tasks")
    }
    if "ix_study_tasks_user_id" not in index_names:
        op.create_index("ix_study_tasks_user_id", "study_tasks", ["user_id"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("study_tasks"):
        index_names = {
            index["name"] for index in inspector.get_indexes("study_tasks")
        }
        if "ix_study_tasks_user_id" in index_names:
            op.drop_index("ix_study_tasks_user_id", table_name="study_tasks")
        op.drop_table("study_tasks")
    if inspector.has_table("study_planner_preferences"):
        op.drop_table("study_planner_preferences")
