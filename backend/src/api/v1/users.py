from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from src.schemas.contracts import (
    UpdateUserRequest
)
from src.db.models import CourseForumPost, User
from src.core.forum_points import (
    POINTS_PER_FORUM_LIKE_RECEIVED,
    POINTS_PER_FORUM_POST_OR_REPLY,
)
from src.db.session import get_db
from src.api.dependencies import get_current_user
from src.core.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    if user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You may only access your own profile.")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )

    return {
        "user_id": user.user_id,
        "public_id": user.public_id,
        "first_name": user.user_first_name,
        "last_name": user.user_last_name,
        "full_name": f"{user.user_first_name} {user.user_last_name}".strip(),
        "email": user.user_email,
        "password_needs_update": user.password_needs_update,
        "forum_points": user.forum_points_balance,
        "forum_point_values": {
            "post_or_reply": POINTS_PER_FORUM_POST_OR_REPLY,
            "like_received": POINTS_PER_FORUM_LIKE_RECEIVED,
        },
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


@router.get("/public/{public_id}")
def get_public_user_profile(public_id: str, db: Session = Depends(get_db)) -> dict:
    user = db.scalar(select(User).where(User.public_id == public_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public profile not found.")
    posts = db.scalars(
        select(CourseForumPost)
        .where(CourseForumPost.user_id == user.user_id)
        .order_by(CourseForumPost.created_at.desc(), CourseForumPost.post_id.desc())
    ).all()
    activity = [
        {
            "post_id": post.post_id,
            "course_id": post.course_id,
            "content": post.content,
            "created_at": post.created_at,
            "role_label": "Posted" if post.parent_post_id is None else "Replied",
        }
        for post in posts
    ]

    return {
        "public_id": user.public_id,
        "first_name": user.user_first_name,
        "last_name": user.user_last_name,
        "full_name": f"{user.user_first_name} {user.user_last_name}".strip(),
        "email": user.user_email,
        "discussion_activity": activity,
    }

@router.put("/{user_id}")
def update_user_profile(user_id: int,payload: UpdateUserRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),) -> dict:
    if user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You may only update your own profile.")
    email = str(payload.email).strip().lower()

    updating_user = db.get(User, user_id)
    if not updating_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    updating_user.user_first_name = payload.first_name
    updating_user.user_last_name = payload.last_name
    updating_user.user_email = email
    if payload.password is not None:
        updating_user.password_hash = hash_password(payload.password)
        updating_user.password_needs_update = False
    db.commit()
    db.refresh(updating_user)

    return {
        "message": "Profile updated successfully.",
        "user": {
            "user_id": updating_user.user_id,
            "first_name": updating_user.user_first_name,
            "last_name": updating_user.user_last_name,
            "email": updating_user.user_email,
        },
    }