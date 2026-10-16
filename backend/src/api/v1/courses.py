from typing import List, Literal
from urllib.parse import unquote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, literal, select
from sqlalchemy.orm import Session

from src.application.uwm_catalog_sync_service import sync_uwm_catalog_courses
from src.core.config import settings
from src.db.models import (
    Course,
    CourseForumPost,
    CourseForumPostBookmark,
    CourseForumPostLike,
    ForumPointTransaction,
    User,
    UserCourseSave,
)
from src.core.forum_points import (
    POINTS_PER_FORUM_LIKE_RECEIVED,
    POINTS_PER_FORUM_POST_OR_REPLY,
)
from src.db.session import get_db
from src.schemas.contracts import (
    CourseCreateRequest,
    ForumPostCreateRequest,
    ForumPostUpdateRequest,
    SaveCourseRequest,
)

router = APIRouter(prefix="/courses", tags=["courses"])


def _serialize_course(course: Course) -> dict:
    return {
        "course_id": course.course_id,
        "title": course.title,
        "description": course.description,
        "professor": course.professor,
        "subject": course.subject,
        "year": course.year,
        "created_at": course.created_at,
        "updated_at": course.updated_at,
    }


def _serialize_user(user: User) -> dict:
    return {
        "user_id": user.user_id,
        "first_name": user.user_first_name,
        "last_name": user.user_last_name,
        "full_name": f"{user.user_first_name} {user.user_last_name}".strip(),
        "email": user.user_email,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


def _get_course_or_404(db: Session, course_id: str) -> Course:
    course = db.get(Course, course_id)
    if course is None and "%" in course_id:
        decoded_course_id = unquote(course_id)
        if decoded_course_id != course_id:
            course = db.get(Course, decoded_course_id)
    if course is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found in the database.",
        )
    return course


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )
    return user


def _assert_user_is_course_member(db: Session, course_id: str, user_id: int) -> None:
    membership = db.scalar(
        select(UserCourseSave.id).where(
            UserCourseSave.course_id == course_id,
            UserCourseSave.user_id == user_id,
        )
    )
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must save this course before participating in forum discussions.",
        )


def _record_forum_points(
    db: Session,
    user: User,
    delta_points: int,
    reason: str,
    related_post_id: int | None = None,
) -> None:
    user.forum_points_balance += delta_points
    db.add(
        ForumPointTransaction(
            user_id=user.user_id,
            delta_points=delta_points,
            reason=reason,
            related_post_id=related_post_id,
        )
    )


def _serialize_forum_post(
    post: CourseForumPost,
    author_name: str,
    is_bookmarked: bool,
    is_liked: bool,
    like_count: int,
) -> dict:
    return {
        "post_id": post.post_id,
        "course_id": post.course_id,
        "user_id": post.user_id,
        "author_name": author_name,
        "parent_post_id": post.parent_post_id,
        "content": post.content,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "is_bookmarked": is_bookmarked,
        "is_liked": is_liked,
        "like_count": like_count,
        "reply_count": 0,
        "replies": [],
    }


def _populate_reply_counts(post_data: dict) -> int:
    total_replies = 0
    for reply in post_data["replies"]:
        total_replies += 1 + _populate_reply_counts(reply)
    post_data["reply_count"] = total_replies
    return total_replies


def _post_matches_search(post_data: dict, normalized_query: str) -> bool:
    if normalized_query in post_data["content"].lower():
        return True
    if normalized_query in post_data["author_name"].lower():
        return True
    return any(_post_matches_search(reply, normalized_query) for reply in post_data["replies"])


def _load_forum_rows(
    db: Session,
    course_id: str,
    user_id: int | None = None,
) -> list[tuple[CourseForumPost, str, str, bool]]:
    if user_id is None:
        return db.execute(
            select(
                CourseForumPost,
                User.user_first_name,
                User.user_last_name,
                literal(False),
            )
            .join(User, User.user_id == CourseForumPost.user_id)
            .where(CourseForumPost.course_id == course_id)
            .order_by(CourseForumPost.created_at.asc(), CourseForumPost.post_id.asc())
        ).all()

    return db.execute(
        select(
            CourseForumPost,
            User.user_first_name,
            User.user_last_name,
            CourseForumPostBookmark.id.is_not(None),
        )
        .join(User, User.user_id == CourseForumPost.user_id)
        .outerjoin(
            CourseForumPostBookmark,
            and_(
                CourseForumPostBookmark.post_id == CourseForumPost.post_id,
                CourseForumPostBookmark.user_id == user_id,
            ),
        )
        .where(CourseForumPost.course_id == course_id)
        .order_by(CourseForumPost.created_at.asc(), CourseForumPost.post_id.asc())
    ).all()


def _load_forum_like_metadata(
    db: Session,
    course_id: str,
    user_id: int | None = None,
) -> tuple[dict[int, int], set[int]]:
    like_count_rows = db.execute(
        select(CourseForumPostLike.post_id, func.count(CourseForumPostLike.id))
        .join(CourseForumPost, CourseForumPost.post_id == CourseForumPostLike.post_id)
        .where(CourseForumPost.course_id == course_id)
        .group_by(CourseForumPostLike.post_id)
    ).all()
    like_counts_by_post_id = {post_id: int(count) for post_id, count in like_count_rows}

    if user_id is None:
        return like_counts_by_post_id, set()

    liked_post_ids = set(
        db.scalars(
            select(CourseForumPostLike.post_id)
            .join(CourseForumPost, CourseForumPost.post_id == CourseForumPostLike.post_id)
            .where(
                CourseForumPost.course_id == course_id,
                CourseForumPostLike.user_id == user_id,
            )
        ).all()
    )
    return like_counts_by_post_id, liked_post_ids


def _build_forum_tree(
    rows: list[tuple[CourseForumPost, str, str, bool]],
    like_counts_by_post_id: dict[int, int],
    liked_post_ids: set[int],
) -> tuple[list[dict], dict[int, dict]]:
    by_id: dict[int, dict] = {}
    root_posts: list[dict] = []

    for post, first_name, last_name, is_bookmarked in rows:
        author_name = f"{first_name} {last_name}".strip()
        by_id[post.post_id] = _serialize_forum_post(
            post,
            author_name,
            bool(is_bookmarked),
            post.post_id in liked_post_ids,
            like_counts_by_post_id.get(post.post_id, 0),
        )

    for post_data in by_id.values():
        parent_post_id = post_data["parent_post_id"]
        if parent_post_id is not None and parent_post_id in by_id:
            by_id[parent_post_id]["replies"].append(post_data)
        else:
            root_posts.append(post_data)

    for post_data in root_posts:
        _populate_reply_counts(post_data)

    return root_posts, by_id


def _search_courses(
    db: Session,
    filters: dict,
    saved_only: bool = False,
    user_id: int | None = None,
    page: int = 1,
    per_page: int = 24,
) -> tuple[List[dict], int]:
    """Queries the database for courses matching the given filters."""
    query = db.query(Course)
    
    # Apply filters dynamically using SQLAlchemy query methods
    if filters.get("subject"):
        query = query.filter(Course.subject.ilike(f"%{filters['subject']}%"))
    if filters.get("courseNumber"):
        query = query.filter(Course.course_id.ilike(f"%{filters['courseNumber']}%"))
    if filters.get("name"):
        # NOTE: Changed to Course.title based on common database schema patterns
        query = query.filter(Course.title.ilike(f"%{filters['name']}%"))
    if filters.get("professor"):
        query = query.filter(Course.professor.ilike(f"%{filters['professor']}%"))
    if filters.get("year") is not None:
        query = query.filter(Course.year == filters["year"])

    if saved_only:
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="user_id is required when savedOnly is true.",
            )
        _get_user_or_404(db, user_id)
        query = query.join(UserCourseSave, UserCourseSave.course_id == Course.course_id).filter(
            UserCourseSave.user_id == user_id
        )

    total_count = query.count()
    offset = (page - 1) * per_page
    courses = query.order_by(Course.title.asc()).offset(offset).limit(per_page).all()
    return [_serialize_course(course) for course in courses], total_count


@router.get("/search")
def search_courses(
    db: Session = Depends(get_db),
    subject: str | None = Query(None, description="Filter by subject (e.g., Computer Science)"),
    courseNumber: str | None = Query(None, description="Filter by course number (e.g., CS101)"),
    name: str | None = Query(None, description="Search by course name (partial match)"),
    professor: str | None = Query(None, description="Filter by professor/instructor name"),
    year: int | None = Query(None, ge=1900, le=3000, description="Filter by course year."),
    savedOnly: bool = Query(False, description="When true, only courses saved by the user are returned."),
    user_id: int | None = Query(None, ge=1, description="Required when savedOnly is true."),
    page: int = Query(1, ge=1, description="1-based page number."),
    per_page: int = Query(24, ge=1, le=100, description="Results per page."),
) -> dict:
    """
    Searches the course catalog by querying the database.
    The database session is managed by FastAPI's dependency injection system.
    """
    search_filters = {}
    # Use the passed arguments directly; they are either None or the search term.
    if subject:
        search_filters["subject"] = subject
    if courseNumber:
        search_filters["courseNumber"] = courseNumber
    if name:
        search_filters["name"] = name
    if professor:
        search_filters["professor"] = professor
    if year is not None:
        search_filters["year"] = year

    courses, total_count = _search_courses(
        db,
        search_filters,
        saved_only=savedOnly,
        user_id=user_id,
        page=page,
        per_page=per_page,
    )
    total_pages = max(1, (total_count + per_page - 1) // per_page)
    return {
        "courses": courses,
        "total_count": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }


@router.get("/subjects")
def list_course_subjects(db: Session = Depends(get_db)) -> List[str]:
    subjects = db.scalars(
        select(Course.subject).distinct().order_by(Course.subject.asc())
    ).all()
    return [subject for subject in subjects if subject]


@router.get("/years")
def list_course_years(db: Session = Depends(get_db)) -> List[int]:
    years = db.scalars(
        select(Course.year).distinct().order_by(Course.year.desc())
    ).all()
    return [year for year in years if year is not None]


@router.post("/catalog/sync-uwm")
def sync_uwm_catalog(
    db: Session = Depends(get_db),
    max_subjects: int | None = Query(
        default=None,
        ge=1,
        description="Optional cap used for smoke-testing sync speed.",
    ),
) -> dict:
    try:
        result = sync_uwm_catalog_courses(
            db,
            base_url=settings.uwm_catalog_base_url.rstrip("/"),
            timeout_seconds=settings.uwm_catalog_timeout_seconds,
            max_subjects=max_subjects,
        )
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch UWM catalog data: {error}",
        ) from error

    return {
        "subjects_processed": result.subject_count,
        "courses_found": result.course_count_found,
        "courses_inserted": result.inserted_count,
        "courses_with_professor_backfill": result.updated_professor_count,
        "failed_subjects": result.failed_subject_count,
        "overwrite_policy": "Existing course_id rows are not replaced; only missing professor values are backfilled.",
    }


@router.get("/{course_id}/forum/posts")
def list_forum_posts(
    course_id: str,
    db: Session = Depends(get_db),
    q: str | None = Query(default=None, description="Search term for post content or author."),
    user_id: int | None = Query(default=None, ge=1, description="Used to resolve bookmark state for posts."),
    author_user_id: int | None = Query(default=None, ge=1, description="Filter to posts authored by this user."),
    bookmarked_only: bool = Query(default=False, description="When true, return only bookmarked discussions."),
    sort: Literal["newest", "popular"] = Query(default="newest", description="Sort mode for root discussions."),
) -> List[dict]:
    _get_course_or_404(db, course_id)
    if user_id is not None:
        _get_user_or_404(db, user_id)
    if author_user_id is not None:
        _get_user_or_404(db, author_user_id)
    if bookmarked_only and user_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="user_id is required when bookmarked_only is true.",
        )

    rows = _load_forum_rows(db, course_id, user_id=user_id)
    like_counts_by_post_id, liked_post_ids = _load_forum_like_metadata(db, course_id, user_id=user_id)

    root_posts, _ = _build_forum_tree(rows, like_counts_by_post_id, liked_post_ids)

    normalized_query = (q or "").strip().lower()
    if normalized_query:
        root_posts = [post for post in root_posts if _post_matches_search(post, normalized_query)]

    if author_user_id is not None:
        root_posts = [post for post in root_posts if post["user_id"] == author_user_id]

    if bookmarked_only:
        root_posts = [post for post in root_posts if post["is_bookmarked"]]

    if sort == "popular":
        root_posts = sorted(
            root_posts,
            key=lambda post: (post["reply_count"], post["created_at"], post["post_id"]),
            reverse=True,
        )
    else:
        root_posts = sorted(
            root_posts,
            key=lambda post: (post["created_at"], post["post_id"]),
            reverse=True,
        )

    return root_posts


@router.get("/{course_id}/forum/posts/{post_id}")
def get_forum_post_thread(
    course_id: str,
    post_id: int,
    db: Session = Depends(get_db),
    user_id: int | None = Query(default=None, ge=1, description="Used to resolve bookmark state for the post."),
) -> dict:
    _get_course_or_404(db, course_id)
    if user_id is not None:
        _get_user_or_404(db, user_id)
    rows = _load_forum_rows(db, course_id, user_id=user_id)
    like_counts_by_post_id, liked_post_ids = _load_forum_like_metadata(db, course_id, user_id=user_id)
    _, by_id = _build_forum_tree(rows, like_counts_by_post_id, liked_post_ids)
    selected = by_id.get(post_id)
    if selected is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' was not found for this course.",
        )
    return selected


@router.post("/{course_id}/forum/posts")
def create_forum_post(
    course_id: str,
    payload: ForumPostCreateRequest,
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    user = _get_user_or_404(db, payload.user_id)
    _assert_user_is_course_member(db, course_id, payload.user_id)

    parent_post_id: int | None = payload.parent_post_id
    if parent_post_id is not None:
        parent_post = db.get(CourseForumPost, parent_post_id)
        if parent_post is None or parent_post.course_id != course_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent forum post '{parent_post_id}' was not found for this course.",
            )

    created = CourseForumPost(
        course_id=course_id,
        user_id=payload.user_id,
        content=payload.content.strip(),
        parent_post_id=parent_post_id,
    )
    db.add(created)
    _record_forum_points(
        db,
        user,
        POINTS_PER_FORUM_POST_OR_REPLY,
        reason="forum_post_or_reply_created",
    )
    db.commit()
    db.refresh(created)
    author_name = f"{user.user_first_name} {user.user_last_name}".strip()
    return _serialize_forum_post(created, author_name, False, False, 0)


@router.put("/{course_id}/forum/posts/{post_id}")
def update_forum_post(
    course_id: str,
    post_id: int,
    payload: ForumPostUpdateRequest,
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    _get_user_or_404(db, payload.user_id)
    post = db.get(CourseForumPost, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' was not found for this course.",
        )
    if post.user_id != payload.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own forum posts.",
        )

    post.content = payload.content.strip()
    db.commit()
    db.refresh(post)

    author = db.get(User, post.user_id)
    author_name = (
        f"{author.user_first_name} {author.user_last_name}".strip()
        if author is not None
        else "Unknown User"
    )
    like_count = db.scalar(
        select(func.count(CourseForumPostLike.id)).where(CourseForumPostLike.post_id == post.post_id)
    )
    user_liked = db.scalar(
        select(CourseForumPostLike.id).where(
            CourseForumPostLike.post_id == post.post_id,
            CourseForumPostLike.user_id == payload.user_id,
        )
    )
    return _serialize_forum_post(post, author_name, False, user_liked is not None, int(like_count or 0))


@router.delete("/{course_id}/forum/posts/{post_id}")
def delete_forum_post(
    course_id: str,
    post_id: int,
    user_id: int = Query(..., ge=1, description="User deleting their own forum post."),
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    _get_user_or_404(db, user_id)
    post = db.get(CourseForumPost, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' was not found for this course.",
        )
    if post.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own forum posts.",
        )

    db.delete(post)
    db.commit()
    return {"message": "Forum post deleted successfully.", "post_id": post_id}


@router.post("/{course_id}/forum/posts/{post_id}/bookmark")
def bookmark_forum_post(
    course_id: str,
    post_id: int,
    user_id: int = Query(..., ge=1, description="User bookmarking the forum post."),
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    _get_user_or_404(db, user_id)
    _assert_user_is_course_member(db, course_id, user_id)
    post = db.get(CourseForumPost, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' was not found for this course.",
        )

    existing_bookmark = db.scalar(
        select(CourseForumPostBookmark.id).where(
            CourseForumPostBookmark.user_id == user_id,
            CourseForumPostBookmark.post_id == post_id,
        )
    )
    if existing_bookmark is not None:
        return {
            "post_id": post_id,
            "user_id": user_id,
            "bookmarked": True,
            "message": "Forum post is already bookmarked.",
        }

    bookmark = CourseForumPostBookmark(user_id=user_id, post_id=post_id)
    db.add(bookmark)
    db.commit()
    return {"post_id": post_id, "user_id": user_id, "bookmarked": True}


@router.delete("/{course_id}/forum/posts/{post_id}/bookmark")
def remove_forum_post_bookmark(
    course_id: str,
    post_id: int,
    user_id: int = Query(..., ge=1, description="User removing their bookmark."),
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    _get_user_or_404(db, user_id)
    post = db.get(CourseForumPost, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' was not found for this course.",
        )

    bookmark = db.scalar(
        select(CourseForumPostBookmark).where(
            CourseForumPostBookmark.user_id == user_id,
            CourseForumPostBookmark.post_id == post_id,
        )
    )
    if bookmark is None:
        return {
            "post_id": post_id,
            "user_id": user_id,
            "bookmarked": False,
            "message": "Forum post was not bookmarked.",
        }

    db.delete(bookmark)
    db.commit()
    return {"post_id": post_id, "user_id": user_id, "bookmarked": False}


@router.post("/{course_id}/forum/posts/{post_id}/like")
def like_forum_post(
    course_id: str,
    post_id: int,
    user_id: int = Query(..., ge=1, description="User liking the forum post."),
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    _get_user_or_404(db, user_id)
    _assert_user_is_course_member(db, course_id, user_id)
    post = db.get(CourseForumPost, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' was not found for this course.",
        )

    existing_like = db.scalar(
        select(CourseForumPostLike.id).where(
            CourseForumPostLike.user_id == user_id,
            CourseForumPostLike.post_id == post_id,
        )
    )
    if existing_like is None:
        db.add(CourseForumPostLike(user_id=user_id, post_id=post_id))
        post_author = _get_user_or_404(db, post.user_id)
        _record_forum_points(
            db,
            post_author,
            POINTS_PER_FORUM_LIKE_RECEIVED,
            reason="forum_like_received",
            related_post_id=post_id,
        )
        db.commit()

    like_count = db.scalar(
        select(func.count(CourseForumPostLike.id)).where(CourseForumPostLike.post_id == post_id)
    )
    return {
        "post_id": post_id,
        "user_id": user_id,
        "liked": True,
        "like_count": int(like_count or 0),
    }


@router.delete("/{course_id}/forum/posts/{post_id}/like")
def unlike_forum_post(
    course_id: str,
    post_id: int,
    user_id: int = Query(..., ge=1, description="User removing their like."),
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    _get_user_or_404(db, user_id)
    post = db.get(CourseForumPost, post_id)
    if post is None or post.course_id != course_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' was not found for this course.",
        )

    existing_like = db.scalar(
        select(CourseForumPostLike).where(
            CourseForumPostLike.user_id == user_id,
            CourseForumPostLike.post_id == post_id,
        )
    )
    if existing_like is not None:
        db.delete(existing_like)
        post_author = _get_user_or_404(db, post.user_id)
        _record_forum_points(
            db,
            post_author,
            -POINTS_PER_FORUM_LIKE_RECEIVED,
            reason="forum_like_removed",
            related_post_id=post_id,
        )
        db.commit()

    like_count = db.scalar(
        select(func.count(CourseForumPostLike.id)).where(CourseForumPostLike.post_id == post_id)
    )
    return {
        "post_id": post_id,
        "user_id": user_id,
        "liked": False,
        "like_count": int(like_count or 0),
    }


@router.get("/saved")
def list_saved_courses(
    user_id: int = Query(..., ge=1, description="User whose saved courses to fetch."),
    db: Session = Depends(get_db),
) -> List[dict]:
    user = _get_user_or_404(db, user_id)
    saved_courses = db.scalars(
        select(Course)
        .join(UserCourseSave, UserCourseSave.course_id == Course.course_id)
        .where(UserCourseSave.user_id == user.user_id)
        .order_by(Course.title.asc())
    ).all()
    return [_serialize_course(course) for course in saved_courses]


@router.get("/{course_id}/members")
def list_course_members(
    course_id: str,
    db: Session = Depends(get_db),
) -> List[dict]:
    _get_course_or_404(db, course_id)
    members = db.scalars(
        select(User)
        .join(UserCourseSave, UserCourseSave.user_id == User.user_id)
        .where(UserCourseSave.course_id == course_id)
        .order_by(User.user_first_name.asc(), User.user_last_name.asc())
    ).all()
    return [_serialize_user(member) for member in members]


@router.get("/users/{user_id}/saved-courses")
def list_user_saved_courses(user_id: int, db: Session = Depends(get_db)) -> List[dict]:
    return list_saved_courses(user_id=user_id, db=db)


@router.get("/{course_id}/saved")
def is_course_saved(
    course_id: str,
    user_id: int = Query(..., ge=1, description="User to check against."),
    db: Session = Depends(get_db),
) -> dict:
    _get_course_or_404(db, course_id)
    _get_user_or_404(db, user_id)
    saved = db.scalar(
        select(UserCourseSave.id).where(
            UserCourseSave.user_id == user_id,
            UserCourseSave.course_id == course_id,
        )
    )
    return {"course_id": course_id, "user_id": user_id, "saved": saved is not None}


@router.post("/{course_id}/save")
def save_course_for_user(
    course_id: str,
    payload: SaveCourseRequest | None = None,
    db: Session = Depends(get_db),
    user_id: int | None = Query(default=None, ge=1, description="User ID to associate the course with."),
) -> dict:
    resolved_user_id = (payload.user_id if payload else user_id)
    if resolved_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A user_id is required to save a course.",
        )

    course = _get_course_or_404(db, course_id)
    user = _get_user_or_404(db, resolved_user_id)

    existing = db.scalar(
        select(UserCourseSave.id).where(
            UserCourseSave.user_id == user.user_id,
            UserCourseSave.course_id == course.course_id,
        )
    )
    if existing is not None:
        return {
            "message": "Course is already saved for this user.",
            "course_id": course.course_id,
            "user_id": user.user_id,
            "saved": True,
        }

    link = UserCourseSave(user_id=user.user_id, course_id=course.course_id)
    db.add(link)
    db.commit()
    return {
        "message": "Course saved successfully.",
        "course_id": course.course_id,
        "user_id": user.user_id,
        "saved": True,
    }


@router.delete("/{course_id}/save")
def unsave_course_for_user(
    course_id: str,
    payload: SaveCourseRequest | None = None,
    db: Session = Depends(get_db),
    user_id: int | None = Query(default=None, ge=1, description="User ID to remove the saved relationship from."),
) -> dict:
    resolved_user_id = (payload.user_id if payload else user_id)
    if resolved_user_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A user_id is required to unsave a course.",
        )

    _get_course_or_404(db, course_id)
    _get_user_or_404(db, resolved_user_id)

    link = db.scalar(
        select(UserCourseSave).where(
            UserCourseSave.user_id == resolved_user_id,
            UserCourseSave.course_id == course_id,
        )
    )
    if link is None:
        return {
            "message": "Course was not saved for this user.",
            "course_id": course_id,
            "user_id": resolved_user_id,
            "saved": False,
        }

    db.delete(link)
    db.commit()
    return {
        "message": "Course removed from saved list.",
        "course_id": course_id,
        "user_id": resolved_user_id,
        "saved": False,
    }


@router.post("/users/{user_id}/courses/{course_id}")
def save_course_by_user_route(
    user_id: int,
    course_id: str,
    db: Session = Depends(get_db),
) -> dict:
    return save_course_for_user(course_id=course_id, payload=SaveCourseRequest(user_id=user_id), db=db)


@router.delete("/users/{user_id}/courses/{course_id}")
def unsave_course_by_user_route(
    user_id: int,
    course_id: str,
    db: Session = Depends(get_db),
) -> dict:
    return unsave_course_for_user(course_id=course_id, payload=SaveCourseRequest(user_id=user_id), db=db)


@router.get("/{course_id}")
def get_course(course_id: str, db: Session = Depends(get_db)) -> dict:
    """Retrieves a single course by its unique ID from the database."""
    course = _get_course_or_404(db, course_id)
    return _serialize_course(course)

@router.get("")
def list_courses():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Listing all courses endpoint is deprecated. Please use /search instead.",
    )

@router.post("")
def create_course(payload: CourseCreateRequest, db: Session = Depends(get_db)) -> dict:
    normalized_course_id = payload.course_id.strip()
    if not normalized_course_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="course_id cannot be blank.",
        )

    existing = db.query(Course).filter(Course.course_id == normalized_course_id).first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course '{normalized_course_id}' already exists.",
        )

    created = Course(
        course_id=normalized_course_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        subject=payload.subject.strip(),
        year=payload.year,
        professor=payload.professor.strip() if payload.professor else None,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return _serialize_course(created)