from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="development", alias="APP_ENV")
    database_url: str = Field(default="", alias="DATABASE_URL")
    cors_origins_raw: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    pinecone_api_key: str = Field(default="", alias="PINECONE_API_KEY")
    pinecone_index_name: str = Field(default="", alias="PINECONE_INDEX_NAME")
    pinecone_namespace: str = Field(default="", alias="PINECONE_NAMESPACE")

    ai_base_url: str = Field(default="http://127.0.0.1:11434", alias="AI_BASE_URL")
    ai_provider: str = Field(default="ollama", alias="AI_PROVIDER")
    ai_model: str = Field(default="qwen3:14b", alias="AI_MODEL")
    ai_timeout: float = Field(default=120.0,gt=0,alias="AI_TIMEOUT")

    embedding_model: str = Field(default="", alias="EMBEDDING_MODEL")
    jwt_secret: str = Field(default="", alias="JWT_SECRET")

    r2_endpoint_url: str | None = Field(default=None, alias="R2_ENDPOINT_URL")
    r2_access_key_id: str | None = Field(default=None, alias="R2_ACCESS_KEY_ID")
    r2_secret_access_key: str | None = Field(default=None, alias="R2_SECRET_ACCESS_KEY")
    r2_bucket_name: str | None = Field(default=None, alias="R2_BUCKET_NAME")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()