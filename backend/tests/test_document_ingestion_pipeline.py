from io import BytesIO
from unittest import TestCase

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from src.application.document_chunker import DocumentChunker
from src.application.document_chunker_service import DocumentChunkingService
from src.application.document_extraction_service import DocumentExtractionService
from src.application.document_ingestion_service import DocumentIngestionService
from src.application.document_normalization_service import DocumentNormalizationService
from src.application.document_normalizer import DocumentNormalizer
from src.application.document_parser import DocumentParserRegistry
from src.application.docs_upload import DocumentUploadInspector
from src.db.base import Base
from src.db.models import DocumentChunkRecord, DocumentVersionRecord, IngestionJobRecord


class FakeObjectStorage:
    def __init__(self):
        self.objects: dict[str, bytes] = {}

    def upload(self, *, key: str, fileobj, content_type: str | None = None) -> None:
        fileobj.seek(0)
        self.objects[key] = fileobj.read()
        fileobj.seek(0)

    def download(self, *, key: str, fileobj) -> None:
        fileobj.write(self.objects[key])

    def delete(self, *, key: str) -> None:
        self.objects.pop(key, None)


class TestDocumentIngestionPipeline(TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)

        self.storage = FakeObjectStorage()

        inspector = DocumentUploadInspector(max_size_bytes=1024 * 1024)

        self.ingestion_service = DocumentIngestionService(
            db=self.db,
            storage=self.storage,
            inspector=inspector,
        )

        extraction_service = DocumentExtractionService(
            db=self.db,
            storage=self.storage,
            parser_registry=DocumentParserRegistry(),
        )

        normalization_service = DocumentNormalizationService(
            db=self.db,
            extraction_service=extraction_service,
            normalizer=DocumentNormalizer(),
        )

        self.chunking_service = DocumentChunkingService(
            db=self.db,
            normalization_service=normalization_service,
            chunker=DocumentChunker(max_words=50, overlap_words=10),
        )

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_uploaded_document_reaches_chunk_persistence(self):
        content = (
            b"  Operating   systems manage processes.\r\n\r\n"
            b"Schedulers choose what runs next.  "
        )

        upload = self.ingestion_service.ingest(
            course_id="cs537",
            title="Operating Systems Notes",
            filename="os-notes.txt",
            declared_media_type="text/plain",
            fileobj=BytesIO(content),
        )

        self.assertEqual(upload.status, "queued")

        version = self.db.get(DocumentVersionRecord, upload.version_id)

        self.assertIsNotNone(version)
        self.assertIn(version.object_key, self.storage.objects)
        self.assertEqual(self.storage.objects[version.object_key], content)

        records = self.chunking_service.process(job_id=upload.job_id)

        self.assertEqual(len(records), 1)

        self.db.expire_all()

        version = self.db.get(DocumentVersionRecord, upload.version_id)
        job = self.db.get(IngestionJobRecord, upload.job_id)

        persisted_chunks = self.db.scalars(
            select(DocumentChunkRecord)
            .where(DocumentChunkRecord.job_id == upload.job_id)
            .order_by(DocumentChunkRecord.chunk_index)
        ).all()

        self.assertIsNotNone(version.content_hash)
        self.assertEqual(len(version.content_hash), 64)

        self.assertEqual(job.status, "processing")
        self.assertEqual(job.current_stage, "chunked")

        self.assertEqual(len(persisted_chunks), 1)
        self.assertEqual(
            persisted_chunks[0].text,
            "Operating systems manage processes. Schedulers choose what runs next.",
        )
        self.assertEqual(persisted_chunks[0].chunk_index, 0)
        self.assertEqual(persisted_chunks[0].source_start_index, 1)
        self.assertEqual(persisted_chunks[0].source_end_index, 1)
        self.assertEqual(persisted_chunks[0].source_start_label, "text:1")
        self.assertEqual(persisted_chunks[0].source_end_label, "text:1")