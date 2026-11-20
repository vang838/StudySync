
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.db.models import Course, CourseForumPost, User
from src.db.session import get_db

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/recent")
def list_recent_discussions(limit: int = Query(12, ge=1, le=30), db: Session = Depends(get_db)) -> list[dict]:
    threads = (
        select(
            CourseForumPost.post_id.label("post_id"),
            CourseForumPost.post_id.label("root_id"),
            CourseForumPost.created_at.label("activity_at"),
        )
        .where(CourseForumPost.parent_post_id.is_(None))
        .cte("thread_posts", recursive=True)
    )

    child = CourseForumPost.__table__.alias("child")
    threads = threads.union_all(
        select(child.c.post_id, threads.c.root_id, child.c.created_at)
        .where(child.c.parent_post_id == threads.c.post_id)
    )

    activity = (
        select(
            threads.c.root_id.label("root_id"),
            func.max(threads.c.activity_at).label("last_activity_at"),
            (func.count() - 1).label("reply_count"),
        )
        .group_by(threads.c.root_id)
        .subquery()
    )

    rows = db.execute(
        select(
            CourseForumPost.post_id,
            CourseForumPost.course_id,
            Course.title.label("course_title"),
            CourseForumPost.content,
            CourseForumPost.created_at,
            User.user_first_name,
            User.user_last_name,
            activity.c.last_activity_at,
            activity.c.reply_count,
        )
        .join(activity, activity.c.root_id == CourseForumPost.post_id)
        .join(Course, Course.course_id == CourseForumPost.course_id)
        .join(User, User.user_id == CourseForumPost.user_id)
        .order_by(activity.c.last_activity_at.desc(), CourseForumPost.post_id.desc())
        .limit(limit)
    ).mappings().all()

    return [
        {
            "post_id": row["post_id"],
            "course_id": row["course_id"],
            "course_title": row["course_title"],
            "author_name": f"{row['user_first_name']} {row['user_last_name']}".strip(),
            "content": row["content"],
            "created_at": row["created_at"],
            "last_activity_at": row["last_activity_at"],
            "reply_count": row["reply_count"],
        }
        for row in rows
    ]
