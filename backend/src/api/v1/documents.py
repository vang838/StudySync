import io

from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.dependencies import get_document_ingestion_service, get_object_storage
from src.application.document_ingestion_service import DocumentIngestionService, DuplicateDocumentError
from src.application.docs_upload import (
    DocumentTooLargeError,
    DocumentTypeMismatchError,
    EmptyDocumentError,
    UnsupportedDocumentTypeError,
)
from src.db.models import DocumentRecord, DocumentVersionRecord
from src.db.session import get_db
from src.ports.object_storage import (
    ObjectNotFoundError,
    ObjectStorageError,
    ObjectStoragePort,
    ObjectStorageUnavailableError,
)
from src.schemas.contracts import DocumentDeleteResponse, DocumentListItemResponse, DocumentUploadResponse
from src.schemas.contracts import DocumentPublishRequest, DocumentPublishResponse

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentListItemResponse])
def list_documents(
    course_id: str | None = Query(default=None, min_length=1),
    published_only: bool = Query(default=True),
    db: Session = Depends(get_db),
) -> list[DocumentListItemResponse]:
    statement = (
        select(DocumentRecord, DocumentVersionRecord)
        .join(DocumentVersionRecord, DocumentVersionRecord.document_id == DocumentRecord.document_id)
        .order_by(DocumentRecord.course_id.asc(), DocumentVersionRecord.created_at.desc())
    )

    if course_id is not None:
        statement = statement.where(DocumentRecord.course_id == course_id)
    if published_only:
        statement = statement.where(DocumentRecord.is_published.is_(True))

    rows = db.execute(statement).all()
    return [
        DocumentListItemResponse(
            document_id=document.document_id,
            version_id=version.version_id,
            course_id=document.course_id,
            title=document.title,
            is_published=document.is_published,
            original_filename=version.original_filename,
            file_size_bytes=version.file_size_bytes,
            created_at=version.created_at,
        )
        for document, version in rows
    ]


@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_202_ACCEPTED)
def upload_document(
    course_id: str = Form(...),
    title: str = Form(..., min_length=1, max_length=200),
    file: UploadFile = File(...),
    service: DocumentIngestionService = Depends(get_document_ingestion_service),
) -> DocumentUploadResponse:
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


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
def delete_document(
    document_id: str,
    db: Session = Depends(get_db),
    storage: ObjectStoragePort = Depends(get_object_storage),
) -> DocumentDeleteResponse:
    document = db.get(DocumentRecord, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document was not found.",
        )

    object_keys = [version.object_key for version in document.versions]

    db.delete(document)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Document deletion could not be committed.",
        ) from exc

    failed_keys: list[str] = []
    for key in object_keys:
        try:
            storage.delete(key=key)
        except ObjectNotFoundError:
            continue
        except (ObjectStorageUnavailableError, ObjectStorageError):
            failed_keys.append(key)

    return DocumentDeleteResponse(
        document_id=document_id,
        deleted=True,
        storage_cleanup_status="partial" if failed_keys else "complete",
        storage_cleanup_failed_keys=failed_keys,
    )


@router.get("/{document_id}/download")
def download_document(
    document_id: str,
    preview: bool = Query(default=False),
    db: Session = Depends(get_db),
    storage: ObjectStoragePort = Depends(get_object_storage),
) -> Response:
    document = db.get(DocumentRecord, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document was not found.",
        )

    version = document.versions[-1] if document.versions else None
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document content was not found.",
        )

    buffer = io.BytesIO()
    try:
        storage.download(key=version.object_key, fileobj=buffer)
    except ObjectNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document content was not found in storage.",
        ) from exc
    except (ObjectStorageUnavailableError, ObjectStorageError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Document storage could not be reached.",
        ) from exc

    payload = buffer.getvalue()
    media_type = version.detected_media_type or version.declared_media_type or "application/octet-stream"
    filename = version.original_filename
    disposition = "inline" if preview else "attachment"
    return Response(
        content=payload,
        media_type=media_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.patch("/{document_id}/publish", response_model=DocumentPublishResponse)
def set_document_publish_state(
    document_id: str,
    payload: DocumentPublishRequest = Body(...),
    db: Session = Depends(get_db),
) -> DocumentPublishResponse:
    document = db.get(DocumentRecord, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document was not found.",
        )

    document.is_published = payload.is_published
    db.add(document)
    db.commit()

    return DocumentPublishResponse(
        document_id=document_id,
        is_published=document.is_published,
    )