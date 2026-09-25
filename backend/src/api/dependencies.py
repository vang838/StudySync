from collections.abc import Generator

from ollama import Client

from src.adapters.llm.ollama import OllamaAdapter
from src.application.chat_service import ChatService
from src.core.config import settings

import boto3
from src.adapters.storage.r2 import R2ObjectStorageAdapter
from src.ports.object_storage import ObjectStoragePort

def get_chat_service() -> Generator[ChatService, None, None]:
    """Create configured AI service"""
    if settings.ai_provider != "ollama":
        raise RuntimeError(f"Unsupported AI provider: {settings.ai_provider}")

    with Client(host=settings.ai_base_url, timeout=settings.ai_timeout) as client:
        llm = OllamaAdapter(client=client, model=settings.ai_model,)

        yield ChatService(llm=llm)

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