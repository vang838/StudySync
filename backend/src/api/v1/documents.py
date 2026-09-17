from fastapi import APIRouter, HTTPException, status

from src.schemas.contracts import DocumentUploadRequest

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents() -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Document storage is not implemented yet.",
    )


@router.post("")
def upload_document(payload: DocumentUploadRequest) -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Document ingestion is not implemented yet.",
    )