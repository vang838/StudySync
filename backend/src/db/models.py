from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ChatThreadRecord(Base):
    __tablename__ = "chat_threads"

    chat_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    course_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    messages: Mapped[list["ChatMessageRecord"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="ChatMessageRecord.id",
    )


class ChatMessageRecord(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chat_id: Mapped[str] = mapped_column(ForeignKey("chat_threads.chat_id", ondelete="CASCADE"), index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    thread: Mapped["ChatThreadRecord"] = relationship(back_populates="messages")

class DocumentRecord(Base):
    __tablename__ = "documents"

    document_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    course_id: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    owner_ref: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    versions: Mapped[list["DocumentVersionRecord"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentVersionRecord.version_number",
    )

class DocumentVersionRecord(Base):
    __tablename__ = "document_versions"

    __table_args__ = (
        UniqueConstraint("document_id", "version_number", name="uq_document_version_number"),
        CheckConstraint("version_number >= 1", name="ck_document_version_positive"),
        CheckConstraint("file_size_bytes >= 0", name="ck_document_file_size_nonnegative"),
    )

    version_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.document_id", ondelete="CASCADE"), index=True, nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    declared_media_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    detected_media_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    file_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)

    object_key: Mapped[str] = mapped_column(String(1024), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    document: Mapped["DocumentRecord"] = relationship(back_populates="versions")

    ingestion_jobs: Mapped[list["IngestionJobRecord"]] = relationship(
        back_populates="document_version",
        cascade="all, delete-orphan",
        order_by="IngestionJobRecord.created_at",
    )

class IngestionJobRecord(Base):
    __tablename__ = "ingestion_jobs"

    __table_args__ = (
        CheckConstraint("retry_count >= 0", name="ck_ingestion_retry_nonnegative"),
    )

    job_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    version_id: Mapped[str] = mapped_column(ForeignKey("document_versions.version_id", ondelete="CASCADE"), index=True, nullable=False)

    status: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    current_stage: Mapped[str | None] = mapped_column(String(64), nullable=True)
    pipeline_version: Mapped[str | None] = mapped_column(String(64), nullable=True)

    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failure_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    failure_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    document_version: Mapped["DocumentVersionRecord"] = relationship(back_populates="ingestion_jobs")

    chunks: Mapped[list["DocumentChunkRecord"]] = relationship(
        back_populates="ingestion_job",
        cascade="all, delete-orphan",
        order_by="DocumentChunkRecord.chunk_index",
    )

class DocumentChunkRecord(Base):
    __tablename__ = "document_chunks"

    __table_args__ = (
        UniqueConstraint("job_id", "chunk_index", name="uq_ingestion_chunk_index"),
        CheckConstraint("chunk_index >= 0", name="ck_document_chunk_index_nonnegative"),
    )

    chunk_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("ingestion_jobs.job_id", ondelete="CASCADE"), index=True, nullable=False)

    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    source_start_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_end_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_start_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_end_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    page_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    page_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    section_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utcnow)

    ingestion_job: Mapped["IngestionJobRecord"] = relationship(back_populates="chunks")