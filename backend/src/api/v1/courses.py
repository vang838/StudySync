from fastapi import APIRouter, HTTPException, status

from src.schemas.contracts import CourseCreateRequest

router = APIRouter(prefix="/courses", tags=["courses"])


@router.get("")
def list_courses() -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Course storage is not implemented yet.",
    )


@router.post("")
def create_course(payload: CourseCreateRequest) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Course storage is not implemented yet.",
    )


@router.get("/{course_id}")
def get_course(course_id: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"Course '{course_id}' is not implemented yet.",
    )