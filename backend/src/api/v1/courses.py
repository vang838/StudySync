from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import Course, CourseForumPost, User, UserCourseSave
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


def _get_course_or_404(db: Session, course_id: str) -> Course:
    course = db.get(Course, course_id)
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


def _serialize_forum_post(post: CourseForumPost, author_name: str) -> dict:
    return {
        "post_id": post.post_id,
        "course_id": post.course_id,
        "user_id": post.user_id,
        "author_name": author_name,
        "parent_post_id": post.parent_post_id,
        "content": post.content,
        "created_at": post.created_at,
        "updated_at": post.updated_at,
        "replies": [],
    }


def _build_forum_tree(rows: list[tuple[CourseForumPost, str, str]]) -> tuple[list[dict], dict[int, dict]]:
    by_id: dict[int, dict] = {}
    root_posts: list[dict] = []

    for post, first_name, last_name in rows:
        author_name = f"{first_name} {last_name}".strip()
        by_id[post.post_id] = _serialize_forum_post(post, author_name)

    for post_data in by_id.values():
        parent_post_id = post_data["parent_post_id"]
        if parent_post_id is not None and parent_post_id in by_id:
            by_id[parent_post_id]["replies"].append(post_data)
        else:
            root_posts.append(post_data)

    return root_posts, by_id


def _search_courses(
    db: Session,
    filters: dict,
    saved_only: bool = False,
    user_id: int | None = None,
) -> List[dict]:
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

    query = query.order_by(Course.title.asc())
    courses = query.all()
    return [_serialize_course(course) for course in courses]


@router.get("/search")
def search_courses(
    db: Session = Depends(get_db),
    subject: str | None = Query(None, description="Filter by subject (e.g., Computer Science)"),
    courseNumber: str | None = Query(None, description="Filter by course number (e.g., CS101)"),
    name: str | None = Query(None, description="Search by course name (partial match)"),
    professor: str | None = Query(None, description="Filter by professor/instructor name"),
    savedOnly: bool = Query(False, description="When true, only courses saved by the user are returned."),
    user_id: int | None = Query(None, ge=1, description="Required when savedOnly is true."),
) -> List[dict]:
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
        
    return _search_courses(db, search_filters, saved_only=savedOnly, user_id=user_id)


@router.get("/subjects")
def list_course_subjects(db: Session = Depends(get_db)) -> List[str]:
    subjects = db.scalars(
        select(Course.subject).distinct().order_by(Course.subject.asc())
    ).all()
    return [subject for subject in subjects if subject]


@router.get("/{course_id}/forum/posts")
def list_forum_posts(course_id: str, db: Session = Depends(get_db)) -> List[dict]:
    _get_course_or_404(db, course_id)
    rows = db.execute(
        select(CourseForumPost, User.user_first_name, User.user_last_name)
        .join(User, User.user_id == CourseForumPost.user_id)
        .where(CourseForumPost.course_id == course_id)
        .order_by(CourseForumPost.created_at.asc(), CourseForumPost.post_id.asc())
    ).all()

    root_posts, _ = _build_forum_tree(rows)
    return root_posts


@router.get("/{course_id}/forum/posts/{post_id}")
def get_forum_post_thread(course_id: str, post_id: int, db: Session = Depends(get_db)) -> dict:
    _get_course_or_404(db, course_id)
    rows = db.execute(
        select(CourseForumPost, User.user_first_name, User.user_last_name)
        .join(User, User.user_id == CourseForumPost.user_id)
        .where(CourseForumPost.course_id == course_id)
        .order_by(CourseForumPost.created_at.asc(), CourseForumPost.post_id.asc())
    ).all()
    _, by_id = _build_forum_tree(rows)
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
    db.commit()
    db.refresh(created)
    author_name = f"{user.user_first_name} {user.user_last_name}".strip()
    return _serialize_forum_post(created, author_name)


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
    return _serialize_forum_post(post, author_name)


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
    # Assuming course_id matches Course.course_id
    course = db.query(Course).filter(Course.course_id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Course '{course_id}' not found in the database.",
        )
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