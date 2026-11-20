from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.dependencies import get_current_user
from src.db.models import Notification, NotificationPreference, User
from src.db.session import get_db
from src.schemas.contracts import NotificationCreateRequest, NotificationPreferenceRequest


router = APIRouter(prefix="/notifications", tags=["notifications"])


def _preferences(db: Session, user: User) -> NotificationPreference:
    preference = db.scalar(
        select(NotificationPreference).where(NotificationPreference.user_id == user.user_id)
    )
    if preference is None:
        preference = NotificationPreference(user_id=user.user_id)
        db.add(preference)
        db.commit()
        db.refresh(preference)
    return preference


@router.get("/preferences")
def get_notification_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    preference = _preferences(db, current_user)
    return {
        "forum_replies": preference.forum_replies,
        "study_tasks": preference.study_tasks,
        "study_materials": preference.study_materials,
        "challenges": preference.challenges,
        "course_file_uploads": preference.course_file_uploads,
        "saved_course_posts": preference.saved_course_posts,
    }


@router.put("/preferences")
def update_notification_preferences(
    payload: NotificationPreferenceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    preference = _preferences(db, current_user)
    preference.forum_replies = payload.forum_replies
    preference.study_tasks = payload.study_tasks
    preference.study_materials = payload.study_materials
    preference.challenges = payload.challenges
    preference.course_file_uploads = payload.course_file_uploads
    preference.saved_course_posts = payload.saved_course_posts
    db.commit()
    db.refresh(preference)
    return {
        "forum_replies": preference.forum_replies,
        "study_tasks": preference.study_tasks,
        "study_materials": preference.study_materials,
        "challenges": preference.challenges,
        "course_file_uploads": preference.course_file_uploads,
        "saved_course_posts": preference.saved_course_posts,
    }


@router.get("")
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    notifications = db.scalars(
        select(Notification)
        .where(Notification.user_id == current_user.user_id)
        .order_by(Notification.created_at.desc(), Notification.notification_id.desc())
        .limit(50)
    ).all()
    return [
        {
            "notification_id": notification.notification_id,
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "link": notification.link,
            "is_read": notification.is_read,
            "created_at": notification.created_at,
        }
        for notification in notifications
    ]


@router.post("")
def create_notification(
    payload: NotificationCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    preference = _preferences(db, current_user)
    preference_map = {
        "forum_reply": preference.forum_replies,
        "study_task": preference.study_tasks,
        "study_material": preference.study_materials,
        "challenge_completed": preference.challenges,
        "course_file_upload": preference.course_file_uploads,
        "saved_course_post": preference.saved_course_posts,
    }
    if not preference_map[payload.type]:
        raise HTTPException(status_code=status.HTTP_204_NO_CONTENT, detail="Notification type is disabled.")

    notification = Notification(
        user_id=current_user.user_id,
        type=payload.type,
        title=payload.title,
        message=payload.message,
        link=payload.link,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return {
        "notification_id": notification.notification_id,
        "type": notification.type,
        "title": notification.title,
        "message": notification.message,
        "link": notification.link,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
    }


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    notification.is_read = True
    db.commit()
    return {"notification_id": notification.notification_id, "is_read": True}


@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    db.delete(notification)
    db.commit()
    return {"notification_id": notification_id, "deleted": True}
