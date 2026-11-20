from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.dependencies import get_current_user
from src.db.models import StudyPlannerPreference, StudyTaskRecord, User, utcnow
from src.db.session import get_db
from src.schemas.contracts import (
    StudyPlannerSettingsUpdate,
    StudyTaskData,
    StudyTasksResponse,
)

router = APIRouter(prefix="/study-tasks", tags=["study tasks"])


def _serialize_task(task: StudyTaskRecord) -> StudyTaskData:
    return StudyTaskData(
        id=task.id,
        title=task.title,
        dueDate=task.due_date,
        course=task.course,
        completed=task.completed,
        importance=task.importance,
        kind=task.kind,
        quadrant=task.quadrant,
        quadrantOverride=task.quadrant_override,
        estimatedHours=task.estimated_hours,
        estimatedPomodoros=task.estimated_pomodoros,
        completedPomodoros=task.completed_pomodoros,
        dependsOn=task.depends_on,
        recurrence=task.recurrence,
        lastPomodoroSessionId=task.last_pomodoro_session_id,
        updatedAt=task.updated_at,
    )


def _get_preference(db: Session, user_id: int) -> StudyPlannerPreference:
    preference = db.get(StudyPlannerPreference, user_id)
    if preference is None:
        preference = StudyPlannerPreference(user_id=user_id)
        db.add(preference)
        db.flush()
    return preference


def _validate_dependencies(
    db: Session,
    user_id: int,
    task_id: str,
    dependencies: list[str],
) -> None:
    if task_id in dependencies:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A task cannot depend on itself.",
        )
    if not dependencies:
        return

    existing_ids = set(
        db.scalars(
            select(StudyTaskRecord.id).where(
                StudyTaskRecord.user_id == user_id,
                StudyTaskRecord.id.in_(dependencies),
            )
        ).all()
    )
    if existing_ids != set(dependencies):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Prerequisite tasks must belong to your planner.",
        )


def _apply_task_data(task: StudyTaskRecord, payload: StudyTaskData) -> None:
    task.title = payload.title.strip()
    task.due_date = payload.due_date
    task.course = payload.course.strip()
    task.completed = payload.completed
    task.importance = payload.importance
    task.kind = payload.kind
    task.quadrant = payload.quadrant
    task.quadrant_override = payload.quadrant_override
    task.estimated_hours = payload.estimated_hours
    task.estimated_pomodoros = payload.estimated_pomodoros
    task.completed_pomodoros = payload.completed_pomodoros
    task.depends_on = payload.depends_on
    task.recurrence = payload.recurrence
    task.last_pomodoro_session_id = payload.last_pomodoro_session_id
    task.updated_at = payload.updated_at


@router.get("", response_model=StudyTasksResponse)
def list_study_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudyTasksResponse:
    preference = _get_preference(db, current_user.user_id)
    tasks = db.scalars(
        select(StudyTaskRecord)
        .where(StudyTaskRecord.user_id == current_user.user_id)
        .order_by(StudyTaskRecord.created_at, StudyTaskRecord.id)
    ).all()
    db.commit()
    return StudyTasksResponse(
        tasks=[_serialize_task(task) for task in tasks],
        autoPrioritizationEnabled=preference.auto_prioritization_enabled,
    )


@router.post("", response_model=StudyTaskData, status_code=status.HTTP_201_CREATED)
def create_study_task(
    payload: StudyTaskData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudyTaskData:
    _validate_dependencies(db, current_user.user_id, payload.id, payload.depends_on)

    task = db.get(StudyTaskRecord, payload.id)
    if task is not None and task.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This task ID is already in use.",
        )
    if task is None:
        task = StudyTaskRecord(id=payload.id, user_id=current_user.user_id)
        db.add(task)

    _apply_task_data(task, payload)
    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.put("/settings")
def update_study_planner_settings(
    payload: StudyPlannerSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    preference = _get_preference(db, current_user.user_id)
    preference.auto_prioritization_enabled = payload.auto_prioritization_enabled
    preference.updated_at = utcnow()
    db.commit()
    return {
        "autoPrioritizationEnabled": preference.auto_prioritization_enabled,
    }


@router.put("/{task_id}", response_model=StudyTaskData)
def update_study_task(
    task_id: str,
    payload: StudyTaskData,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StudyTaskData:
    if task_id != payload.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task ID in the path must match the request body.",
        )
    _validate_dependencies(db, current_user.user_id, task_id, payload.depends_on)

    task = db.scalar(
        select(StudyTaskRecord).where(
            StudyTaskRecord.id == task_id,
            StudyTaskRecord.user_id == current_user.user_id,
        )
    )
    if task is None:
        existing_task = db.get(StudyTaskRecord, task_id)
        if existing_task is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This task ID is already in use.",
            )
        task = StudyTaskRecord(id=task_id, user_id=current_user.user_id)
        db.add(task)

    _apply_task_data(task, payload)
    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    task = db.scalar(
        select(StudyTaskRecord).where(
            StudyTaskRecord.id == task_id,
            StudyTaskRecord.user_id == current_user.user_id,
        )
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")

    dependents = db.scalars(
        select(StudyTaskRecord).where(
            StudyTaskRecord.user_id == current_user.user_id,
            StudyTaskRecord.id != task_id,
        )
    ).all()
    for dependent in dependents:
        if task_id in dependent.depends_on:
            dependent.depends_on = [
                dependency
                for dependency in dependent.depends_on
                if dependency != task_id
            ]

    db.delete(task)
    db.commit()
