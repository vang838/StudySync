from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.db.models import User
from src.db.session import get_db
from src.schemas.contracts import AuthLoginRequest, AuthRegisterRequest
from src.core.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login")
def login(payload: AuthLoginRequest, db: Session = Depends(get_db)):

    email = str(payload.email).strip().lower()
    existing_user = db.scalar(select(User).where(User.user_email == email))

    if not existing_user or not verify_password(
        payload.password, existing_user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    return {
        "message": "Login successful.",
        "user": {
            "user_id": existing_user.user_id,
            "first_name": existing_user.user_first_name,
            "last_name": existing_user.user_last_name,
            "email": existing_user.user_email,
        },
    }
    

@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(
    payload: AuthRegisterRequest,
    db: Session = Depends(get_db)
):
    # Check if email is already registered
    existing_user = db.scalar(
        select(User).where(User.user_email == payload.email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists."
        )

    # Hash password
    hashed_password = hash_password(payload.password)

    # Create user
    new_user = User(
        user_first_name=payload.first_name,
        user_last_name=payload.last_name,
        user_email=payload.email,
        password_hash=hashed_password
    )

    # Save user
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "Account created successfully.",
        "user": {
            "user_id": new_user.user_id,
            "first_name": new_user.user_first_name,
            "last_name": new_user.user_last_name,
            "email": new_user.user_email
        }
    }

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
