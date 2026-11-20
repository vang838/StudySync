from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from src.application.document_chunker_service import DocumentChunkingService
from src.application.document_ingestion_worker import DocumentIngestionWorker
from src.application.document_vector_indexing_service import DocumentVectorIndexingService
from src.db.base import Base
from src.db.models import DocumentRecord, DocumentVersionRecord, IngestionJobRecord, utcnow


class TestDocumentIngestionWorker(TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False)

        with self.session_factory() as db:
            db.add(DocumentRecord(
                document_id="doc-1",
                course_id="CS537",
                title="Operating Systems Notes",
                is_published=False,
            ))
            db.add(DocumentVersionRecord(
                version_id="version-1",
                document_id="doc-1",
                version_number=1,
                original_filename="notes.txt",
                detected_media_type="text/plain",
                file_size_bytes=12,
                file_hash="a" * 64,
                object_key="documents/doc-1/versions/version-1/original.txt",
            ))
            db.add(IngestionJobRecord(
                job_id="job-1",
                version_id="version-1",
                status="queued",
                current_stage="uploaded",
                pipeline_version="1",
            ))
            db.commit()

        self.chunk_calls = 0
        self.index_calls = 0
        self.fail_index = False

        self.worker = DocumentIngestionWorker(
            session_factory=self.session_factory,
            chunking_factory=self._chunking_factory,
            indexing_factory=self._indexing_factory,
            retry_delay_seconds=0,
        )

    def tearDown(self) -> None:
        self.engine.dispose()

    def _chunking_factory(self, db: Session) -> DocumentChunkingService:
        service = Mock(spec=DocumentChunkingService)

        def process(*, job_id: str):
            self.chunk_calls += 1
            job = db.get(IngestionJobRecord, job_id)
            job.status = "processing"
            job.current_stage = "chunked"
            db.commit()
            return []

        service.process.side_effect = process
        return service

    def _indexing_factory(self, db: Session) -> DocumentVectorIndexingService:
        service = Mock(spec=DocumentVectorIndexingService)

        def index_job(*, job_id: str) -> int:
            self.index_calls += 1
            if self.fail_index: raise RuntimeError("Simulated indexing failure")

            job = db.get(IngestionJobRecord, job_id)
            job.status = "ready"
            job.current_stage = "indexed"
            job.completed_at = utcnow()
            db.commit()
            return 1

        service.index_job.side_effect = index_job
        return service

    def _get_job(self) -> IngestionJobRecord:
        with self.session_factory() as db:
            return db.get(IngestionJobRecord, "job-1")

    def test_queued_document_is_processed_automatically(self) -> None:
        self.assertTrue(self.worker.run_once())

        job = self._get_job()
        self.assertEqual(job.status, "ready")
        self.assertEqual(job.current_stage, "indexed")
        self.assertIsNotNone(job.completed_at)
        self.assertEqual(self.chunk_calls, 1)
        self.assertEqual(self.index_calls, 1)

        self.assertFalse(self.worker.run_once())
        self.assertEqual(self.index_calls, 1)

    def test_failed_indexing_retries_without_rechunking(self) -> None:
        self.fail_index = True

        for attempt in range(1, 4):
            self.assertTrue(self.worker.run_once())
            job = self._get_job()

            expected_status = "failed" if attempt == 3 else "queued"
            self.assertEqual(job.status, expected_status)
            self.assertEqual(job.retry_count, attempt)
            self.assertEqual(job.current_stage, "chunked")

        self.assertEqual(self.chunk_calls, 1)
        self.assertEqual(self.index_calls, 3)
        self.assertFalse(self.worker.run_once())

    def test_interrupted_job_resumes_from_chunked_stage(self) -> None:
        with self.session_factory() as db:
            job = db.get(IngestionJobRecord, "job-1")
            job.status = "processing"
            job.current_stage = "chunked"
            db.commit()

        recovered = self.worker.recover_interrupted()

        self.assertEqual(recovered, 1)
        self.assertEqual(self._get_job().status, "queued")
        self.assertEqual(self._get_job().retry_count, 1)

        self.assertTrue(self.worker.run_once())
        self.assertEqual(self._get_job().status, "ready")
        self.assertEqual(self.chunk_calls, 0)
        self.assertEqual(self.index_calls, 1)
