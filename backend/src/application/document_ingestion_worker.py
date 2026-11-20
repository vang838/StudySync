import logging
from collections.abc import Callable
from datetime import timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.application.document_chunker_service import DocumentChunkingService
from src.application.document_vector_indexing_service import DocumentVectorIndexingService
from src.db.models import IngestionJobRecord, utcnow


logger = logging.getLogger(__name__)


class DocumentIngestionWorker:
    """Process persisted document jobs using the existing ingestion services."""

    def __init__(
        self,
        session_factory: Callable[[], Session],
        chunking_factory: Callable[[Session], DocumentChunkingService],
        indexing_factory: Callable[[Session], DocumentVectorIndexingService],
        max_attempts: int = 3,
        retry_delay_seconds: int = 10,
    ) -> None:
        if max_attempts < 1: raise ValueError("max_attempts must be positive")
        if retry_delay_seconds < 0: raise ValueError("retry_delay_seconds cannot be negative")

        self._session_factory = session_factory
        self._chunking_factory = chunking_factory
        self._indexing_factory = indexing_factory
        self._max_attempts = max_attempts
        self._retry_delay_seconds = retry_delay_seconds

    def _claim_next(self) -> str | None:
        cutoff = utcnow() - timedelta(seconds=self._retry_delay_seconds)

        with self._session_factory() as db:
            job = db.scalar(
                select(IngestionJobRecord)
                .where(
                    IngestionJobRecord.status == "queued",
                    IngestionJobRecord.retry_count < self._max_attempts,
                    or_(
                        IngestionJobRecord.retry_count == 0,
                        IngestionJobRecord.updated_at <= cutoff,
                    ),
                )
                .order_by(IngestionJobRecord.created_at, IngestionJobRecord.job_id)
                .limit(1)
                .with_for_update(skip_locked=True)
            )

            if job is None: return None

            job.status = "processing"
            job.started_at = job.started_at or utcnow()
            job.updated_at = utcnow()
            job.failure_code = None
            job.failure_message = None
            db.commit()

            return job.job_id

    def recover_interrupted(self) -> int:
        """Recover jobs after acquiring exclusive worker ownership."""
        recovered = 0

        with self._session_factory() as db:
            jobs = db.scalars(
                select(IngestionJobRecord).where(IngestionJobRecord.status == "processing")
            ).all()

            for job in jobs:
                job.retry_count += 1
                job.status = "failed" if job.retry_count >= self._max_attempts else "queued"
                job.failure_code = "WorkerInterrupted"
                job.failure_message = "Document processing was interrupted."
                job.updated_at = utcnow()
                recovered += 1

            db.commit()

        return recovered

    def run_once(self) -> bool:
        """Process one eligible job; return False when no job is available."""
        job_id = self._claim_next()
        if job_id is None: return False

        with self._session_factory() as db:
            try:
                job = db.get(IngestionJobRecord, job_id)
                if job is None: return True

                if job.current_stage != "chunked":
                    self._chunking_factory(db).process(job_id=job_id)

                self._indexing_factory(db).index_job(job_id=job_id)
                logger.info("Document ingestion completed: %s", job_id)
            except Exception as exc:
                db.rollback()
                logger.exception("Document ingestion failed: %s", job_id)

                job = db.get(IngestionJobRecord, job_id)
                if job is None: return True

                job.retry_count += 1
                job.status = "failed" if job.retry_count >= self._max_attempts else "queued"
                job.failure_code = type(exc).__name__[:64]
                job.failure_message = "Document processing failed; check worker logs."
                job.updated_at = utcnow()
                db.commit()

        return True
