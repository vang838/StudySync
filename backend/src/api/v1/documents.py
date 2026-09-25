from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from src.api.dependencies import get_document_ingestion_service
from src.application.document_ingestion_service import DocumentIngestionService, DuplicateDocumentError
from src.application.docs_upload import (
    DocumentTooLargeError,
    DocumentTypeMismatchError,
    EmptyDocumentError,
    UnsupportedDocumentTypeError,
)
from src.ports.object_storage import ObjectStorageError, ObjectStorageUnavailableError
from src.schemas.contracts import DocumentUploadResponse

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("")
def list_documents() -> None:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Document listing is not implemented yet.",
    )


@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_202_ACCEPTED)
def upload_document(course_id: str = Form(...), title: str = Form(..., min_length=1, max_length=200), file: UploadFile = File(...), service: DocumentIngestionService = Depends(get_document_ingestion_service),) -> DocumentUploadResponse:
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file must have a filename.")

    try:
        result = service.ingest(
            course_id=course_id,
            title=title,
            filename=file.filename,
            declared_media_type=file.content_type,
            fileobj=file.file,
        )
    except DocumentTooLargeError as exc:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc

    except (UnsupportedDocumentTypeError, DocumentTypeMismatchError) as exc:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc)) from exc

    except EmptyDocumentError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    except DuplicateDocumentError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    except ObjectStorageUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Document storage is unavailable.") from exc

    except ObjectStorageError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Document storage failed.") from exc


    return DocumentUploadResponse(
        document_id=result.document_id,
        version_id=result.version_id,
        job_id=result.job_id,
        course_id=result.course_id,
        title=result.title,
        original_filename=result.original_filename,
        file_size_bytes=result.file_size_bytes,
        status=result.status,
    )