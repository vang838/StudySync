from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.schemas.contracts import (
    UpdateUserRequest
)
from src.db.models import User
from src.core.forum_points import (
    POINTS_PER_FORUM_LIKE_RECEIVED,
    POINTS_PER_FORUM_POST_OR_REPLY,
)
from src.db.session import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}")
def get_user_profile(user_id: int, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )

    return {
        "user_id": user.user_id,
        "first_name": user.user_first_name,
        "last_name": user.user_last_name,
        "full_name": f"{user.user_first_name} {user.user_last_name}".strip(),
        "email": user.user_email,
        "forum_points": user.forum_points_balance,
        "forum_point_values": {
            "post_or_reply": POINTS_PER_FORUM_POST_OR_REPLY,
            "like_received": POINTS_PER_FORUM_LIKE_RECEIVED,
        },
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }

@router.put("/{user_id}")
def update_user_profile(user_id: int,payload: UpdateUserRequest, db: Session = Depends(get_db),) -> dict:
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