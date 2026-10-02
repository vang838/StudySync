from collections.abc import Generator

from ollama import Client

from src.core.config import settings

from src.adapters.llm.ollama import OllamaAdapter
from src.adapters.embedding.ollama import OllamaEmbeddingAdapter

from src.adapters.storage.r2 import R2ObjectStorageAdapter

from src.application.chat_service import ChatService
from src.application.document_ingestion_service import DocumentIngestionService
from src.application.docs_upload import DocumentUploadInspector
from src.application.document_extraction_service import DocumentExtractionService
from src.application.document_parser import DocumentParserRegistry
from src.application.document_normalization_service import DocumentNormalizationService
from src.application.document_normalizer import DocumentNormalizer
from src.application.document_chunker import DocumentChunker
from src.application.document_chunker_service import DocumentChunkingService
from src.application.document_embedding_service import DocumentEmbeddingService
from src.application.document_retrieval_service import DocumentRetrievalService

from src.db.session import get_db

from src.ports.object_storage import ObjectStoragePort
from src.ports.embedding import EmbeddingPort

from fastapi import Depends
from sqlalchemy.orm import Session

from pinecone import Pinecone

from src.adapters.vector_store.pinecone import PineconeVectorStoreAdapter
from src.application.document_embedding_service import DocumentEmbeddingService
from src.application.document_vector_indexing_service import DocumentVectorIndexingService
from src.ports.embedding import EmbeddingPort
from src.ports.vector_store import VectorStorePort

import boto3

def get_chat_service() -> Generator[ChatService, None, None]:
    """Create configured AI service"""
    if settings.ai_provider != "ollama":
        raise RuntimeError(f"Unsupported AI provider: {settings.ai_provider}")

    with Client(host=settings.ai_base_url, timeout=settings.ai_timeout) as client:
        llm = OllamaAdapter(client=client, model=settings.ai_model)

        yield ChatService(llm=llm)

def get_embedding_port() -> Generator[EmbeddingPort, None, None]:
    """Create configured embedding provider."""
    if settings.embedding_provider != "ollama":
        raise RuntimeError(
            f"Unsupported embedding provider: {settings.embedding_provider}"
        )

    with Client(host=settings.embedding_base_url, timeout=settings.embedding_timeout, ) as client:
        yield OllamaEmbeddingAdapter(
            client=client,
            model=settings.embedding_model,
            dimension=settings.embedding_dimension,
        )

def get_object_storage() -> ObjectStoragePort:
    if not settings.r2_endpoint_url:
        raise RuntimeError("R2_ENDPOINT_URL is not configured.")

    if not settings.r2_access_key_id:
        raise RuntimeError("R2_ACCESS_KEY_ID is not configured.")

    if not settings.r2_secret_access_key:
        raise RuntimeError("R2_SECRET_ACCESS_KEY is not configured.")

    if not settings.r2_bucket_name:
        raise RuntimeError("R2_BUCKET_NAME is not configured.")

    client = boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )

    return R2ObjectStorageAdapter(client=client, bucket_name=settings.r2_bucket_name)

def get_document_upload_inspector() -> DocumentUploadInspector:
    return DocumentUploadInspector(max_size_bytes=settings.document_max_upload_bytes)


def get_document_ingestion_service(db: Session = Depends(get_db), storage: ObjectStoragePort = Depends(get_object_storage), inspector: DocumentUploadInspector = Depends(get_document_upload_inspector),) -> DocumentIngestionService:
    return DocumentIngestionService(db=db, storage=storage, inspector=inspector)

def get_document_parser_registry() -> DocumentParserRegistry:
    return DocumentParserRegistry()


def get_document_extraction_service(db: Session = Depends(get_db), storage: ObjectStoragePort = Depends(get_object_storage), parser_registry: DocumentParserRegistry = Depends(get_document_parser_registry),) -> DocumentExtractionService:
    return DocumentExtractionService(db=db, storage=storage, parser_registry=parser_registry)

def get_document_normalizer() -> DocumentNormalizer:
    return DocumentNormalizer()

def get_document_normalization_service(db: Session = Depends(get_db), extraction_service: DocumentExtractionService = Depends(get_document_extraction_service), normalizer: DocumentNormalizer = Depends(get_document_normalizer),) -> DocumentNormalizationService:
    return DocumentNormalizationService(db=db, extraction_service=extraction_service, normalizer=normalizer)

def get_document_chunker() -> DocumentChunker:
    return DocumentChunker(max_words=settings.document_chunk_max_words, overlap_words=settings.document_chunk_overlap_words,)


def get_document_chunking_service(db: Session = Depends(get_db), normalization_service: DocumentNormalizationService = Depends(get_document_normalization_service), chunker: DocumentChunker = Depends(get_document_chunker),) -> DocumentChunkingService:
    return DocumentChunkingService(db=db, normalization_service=normalization_service, chunker=chunker)

def get_document_embedding_service(db: Session = Depends(get_db), embedding_port: EmbeddingPort = Depends(get_embedding_port),) -> DocumentEmbeddingService:
    return DocumentEmbeddingService(db=db, embedding_port=embedding_port, batch_size=settings.embedding_batch_size,)

def get_vector_store() -> VectorStorePort:
    if not settings.pinecone_api_key:
        raise RuntimeError("PINECONE_API_KEY is not configured.")

    if not settings.pinecone_index_name:
        raise RuntimeError("PINECONE_INDEX_NAME is not configured.")

    if not settings.pinecone_namespace:
        raise RuntimeError("PINECONE_NAMESPACE is not configured.")

    client = Pinecone(api_key=settings.pinecone_api_key)
    index = client.index(settings.pinecone_index_name)

    return PineconeVectorStoreAdapter(
        index=index,
        namespace=settings.pinecone_namespace,
        batch_size=settings.pinecone_batch_size,
    )

def get_document_vector_indexing_service(db: Session = Depends(get_db), embedding_service: DocumentEmbeddingService = Depends(get_document_embedding_service), vector_store: VectorStorePort = Depends(get_vector_store)) -> DocumentVectorIndexingService:
    return DocumentVectorIndexingService(db=db, embedding_service=embedding_service, vector_store=vector_store,)

def get_document_retrieval_service(db: Session = Depends(get_db), embedding_port: EmbeddingPort = Depends(get_embedding_port), vector_store: VectorStorePort = Depends(get_vector_store),) -> DocumentRetrievalService:
    return DocumentRetrievalService(db=db, embedding_port=embedding_port, vector_store=vector_store)