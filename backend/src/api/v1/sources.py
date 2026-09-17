from fastapi import APIRouter, HTTPException, status

router = APIRouter(prefix="/sources", tags=["sources"])


@router.get("/{source_id}")
def get_source(source_id: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"Source '{source_id}' is not implemented yet.",
    )