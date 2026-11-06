"""Add flashcard sets, ordered cards, and per-user study ratings."""
from alembic import op
import sqlalchemy as sa

revision = "e5b2c9a7d401"
down_revision = "d3a1b0f4e6c8"
branch_labels = None
depends_on = None


def upgrade():
    # Local startup may already have created these tables via metadata.create_all.
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "flashcard_sets" not in tables:
        op.create_table(
            "flashcard_sets",
            sa.Column("flashcard_set_id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
            sa.Column("course_id", sa.String(128), sa.ForeignKey("courses.course_id", ondelete="RESTRICT"), nullable=False),
            sa.Column("title", sa.String(200), nullable=False),
            sa.Column("description", sa.Text()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_flashcard_sets_user_id", "flashcard_sets", ["user_id"])
        op.create_index("ix_flashcard_sets_course_id", "flashcard_sets", ["course_id"])
    if "flashcard" not in tables:
        op.create_table(
            "flashcard",
            sa.Column("flashcard_id", sa.Integer(), primary_key=True),
            sa.Column("flashcardsets_id", sa.Integer(), sa.ForeignKey("flashcard_sets.flashcard_set_id", ondelete="CASCADE"), nullable=False),
            sa.Column("question", sa.Text(), nullable=False),
            sa.Column("answer", sa.Text(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_flashcard_flashcardsets_id", "flashcard", ["flashcardsets_id"])
    if "flashcard_study_progress" not in tables:
        op.create_table(
            "flashcard_study_progress",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False),
            sa.Column("flashcard_id", sa.Integer(), sa.ForeignKey("flashcard.flashcard_id", ondelete="CASCADE"), nullable=False),
            sa.Column("rating", sa.String(20), nullable=False),
            sa.Column("last_reviewed_at", sa.DateTime(timezone=True), nullable=False),
            sa.UniqueConstraint("user_id", "flashcard_id", name="uq_flashcard_progress_user_card"),
        )
        op.create_index("ix_flashcard_study_progress_user_id", "flashcard_study_progress", ["user_id"])
        op.create_index("ix_flashcard_study_progress_flashcard_id", "flashcard_study_progress", ["flashcard_id"])


def downgrade():
    op.drop_table("flashcard_study_progress")
    op.drop_table("flashcard")
    op.drop_table("flashcard_sets")
