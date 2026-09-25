from sqlalchemy.orm import Session

from src.application.document_extraction_service import DocumentExtractionService
from src.application.document_normalizer import DocumentNormalizer, NormalizedDocument
from src.db.models import DocumentVersionRecord

class DocumentNormalizationVersionNotFoundError(Exception):
    pass

class DocumentNormalizationService:
    def __init__(self, db: Session, extraction_service: DocumentExtractionService, normalizer: DocumentNormalizer):
        self._db = db
        self._extraction_service = extraction_service
        self._normalizer = normalizer

    def normalize(self, *, version_id: str) -> NormalizedDocument:
        version = self._db.get(DocumentVersionRecord, version_id)

        if version is None:
            raise DocumentNormalizationVersionNotFoundError(f"Document version '{version_id}' was not found.")

        extracted = self._extraction_service.extract(version_id=version_id)
        normalized = self._normalizer.normalize(extracted)

        version.content_hash = normalized.content_hash
        self._db.commit()

        return normalized