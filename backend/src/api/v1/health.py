from fastapi import APIRouter

from src.core.config import settings
from src.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    return HealthResponse(
        status="success",
        service="StudySync API",
        environment=settings.app_env,
    )