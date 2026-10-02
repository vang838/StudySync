from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.db.models import User
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
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }


