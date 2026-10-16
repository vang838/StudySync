"""add forum points currency and likes

Revision ID: c4f7a8d1e2b3
Revises: 8812ff7d578f
Create Date: 2026-10-14 18:33:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c4f7a8d1e2b3"
down_revision: Union[str, Sequence[str], None] = "8812ff7d578f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_names(inspector, table_name: str) -> set[str]:
    if table_name not in inspector.get_table_names():
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    user_columns = _column_names(inspector, "users")
    if "forum_points_balance" not in user_columns:
        op.add_column(
            "users",
            sa.Column("forum_points_balance", sa.Integer(), nullable=False, server_default="0"),
        )
        op.alter_column("users", "forum_points_balance", server_default=None)

    if "course_forum_post_bookmarks" not in table_names:
        op.create_table(
            "course_forum_post_bookmarks",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
            sa.Column("post_id", sa.Integer(), sa.ForeignKey("course_forum_posts.post_id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "post_id", name="uq_forum_post_bookmark_user_post"),
        )
        op.create_index(op.f("ix_course_forum_post_bookmarks_user_id"), "course_forum_post_bookmarks", ["user_id"], unique=False)
        op.create_index(op.f("ix_course_forum_post_bookmarks_post_id"), "course_forum_post_bookmarks", ["post_id"], unique=False)

    if "course_forum_post_likes" not in table_names:
        op.create_table(
            "course_forum_post_likes",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
            sa.Column("post_id", sa.Integer(), sa.ForeignKey("course_forum_posts.post_id", ondelete="CASCADE"), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "post_id", name="uq_forum_post_like_user_post"),
        )
        op.create_index(op.f("ix_course_forum_post_likes_user_id"), "course_forum_post_likes", ["user_id"], unique=False)
        op.create_index(op.f("ix_course_forum_post_likes_post_id"), "course_forum_post_likes", ["post_id"], unique=False)

    if "forum_point_transactions" not in table_names:
        op.create_table(
            "forum_point_transactions",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
            sa.Column("delta_points", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(length=64), nullable=False),
            sa.Column("related_post_id", sa.Integer(), sa.ForeignKey("course_forum_posts.post_id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index(op.f("ix_forum_point_transactions_user_id"), "forum_point_transactions", ["user_id"], unique=False)
        op.create_index(op.f("ix_forum_point_transactions_related_post_id"), "forum_point_transactions", ["related_post_id"], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "forum_point_transactions" in table_names:
        op.drop_index(op.f("ix_forum_point_transactions_related_post_id"), table_name="forum_point_transactions")
        op.drop_index(op.f("ix_forum_point_transactions_user_id"), table_name="forum_point_transactions")
        op.drop_table("forum_point_transactions")

    if "course_forum_post_likes" in table_names:
        op.drop_index(op.f("ix_course_forum_post_likes_post_id"), table_name="course_forum_post_likes")
        op.drop_index(op.f("ix_course_forum_post_likes_user_id"), table_name="course_forum_post_likes")
        op.drop_table("course_forum_post_likes")

    if "course_forum_post_bookmarks" in table_names:
        op.drop_index(op.f("ix_course_forum_post_bookmarks_post_id"), table_name="course_forum_post_bookmarks")
        op.drop_index(op.f("ix_course_forum_post_bookmarks_user_id"), table_name="course_forum_post_bookmarks")
        op.drop_table("course_forum_post_bookmarks")

    user_columns = _column_names(inspector, "users")
    if "forum_points_balance" in user_columns:
        op.drop_column("users", "forum_points_balance")
