"""add per-user course archive flag

Revision ID: d3a1b0f4e6c8
Revises: c4f7a8d1e2b3
Create Date: 2026-10-23 02:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3a1b0f4e6c8"
down_revision: Union[str, Sequence[str], None] = "c4f7a8d1e2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(inspector, table_name: str) -> set[str]:
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    member_columns = _column_names(inspector, "course_members")

    if "is_archived" not in member_columns:
        op.add_column(
            "course_members",
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column("course_members", "is_archived", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    member_columns = _column_names(inspector, "course_members")

    if "is_archived" in member_columns:
        op.drop_column("course_members", "is_archived")
