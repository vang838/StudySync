import fcntl
import logging
from contextlib import contextmanager
from pathlib import Path
from time import sleep
from typing import Iterator

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from src.api.dependencies import get_embedding_port, get_object_storage, get_vector_store
from src.application.document_chunker import DocumentChunker
from src.application.document_chunker_service import DocumentChunkingService
from src.application.document_embedding_service import DocumentEmbeddingService
from src.application.document_extraction_service import DocumentExtractionService
from src.application.document_ingestion_worker import DocumentIngestionWorker
from src.application.document_normalization_service import DocumentNormalizationService
from src.application.document_normalizer import DocumentNormalizer
from src.application.document_parser import DocumentParserRegistry
from src.application.document_vector_indexing_service import DocumentVectorIndexingService
from src.core.config import settings
from src.db.session import get_engine, get_session_factory


logger = logging.getLogger(__name__)


@contextmanager
def exclusive_worker_lock(engine: Engine) -> Iterator[None]:
    if engine.dialect.name == "postgresql":
        with engine.connect() as connection:
            acquired = connection.exec_driver_sql("SELECT pg_try_advisory_lock(14042026)").scalar()
            connection.commit()

            if not acquired: raise RuntimeError("Another ingestion worker is already running.")

            try:
                yield
            finally:
                connection.exec_driver_sql("SELECT pg_advisory_unlock(14042026)")
                connection.commit()
        return

    if engine.dialect.name == "sqlite":
        database_path = engine.url.database
        if not database_path or database_path == ":memory:":
            raise RuntimeError("The ingestion worker requires a persistent SQLite database.")

        lock_path = Path(f"{database_path}.ingestion-worker.lock")
        with lock_path.open("a+") as handle:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError as exc:
                raise RuntimeError("Another ingestion worker is already running.") from exc

            try:
                yield
            finally:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)
        return

    raise RuntimeError(f"Unsupported ingestion worker database: {engine.dialect.name}")


def build_chunking_service(db: Session, storage) -> DocumentChunkingService:
    extraction = DocumentExtractionService(
        db=db, storage=storage, parser_registry=DocumentParserRegistry(),
    )
    normalization = DocumentNormalizationService(
        db=db, extraction_service=extraction, normalizer=DocumentNormalizer(),
    )
    chunker = DocumentChunker(
        max_words=settings.document_chunk_max_words,
        overlap_words=settings.document_chunk_overlap_words,
    )
    return DocumentChunkingService(
        db=db, normalization_service=normalization, chunker=chunker,
    )


def build_indexing_service(db: Session, embedding, vector_store) -> DocumentVectorIndexingService:
    embedding_service = DocumentEmbeddingService(
        db=db, embedding_port=embedding, batch_size=settings.embedding_batch_size,
    )
    return DocumentVectorIndexingService(
        db=db, embedding_service=embedding_service, vector_store=vector_store,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    engine = get_engine()

    with exclusive_worker_lock(engine):
        storage = get_object_storage()
        vector_store = get_vector_store()

        with contextmanager(get_embedding_port)() as embedding:
            worker = DocumentIngestionWorker(
                session_factory=get_session_factory(),
                chunking_factory=lambda db: build_chunking_service(db, storage),
                indexing_factory=lambda db: build_indexing_service(db, embedding, vector_store),
            )

            recovered = worker.recover_interrupted()
            logger.info("Ingestion worker started; recovered %s interrupted jobs.", recovered)

            while True:
                if not worker.run_once(): sleep(2)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Ingestion worker stopped.")
