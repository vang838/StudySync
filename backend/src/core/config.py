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
    ai_provider: str = Field(default="openai", alias="AI_PROVIDER")
    ai_api_key: str = Field(default="", alias="AI_API_KEY")
    ai_model: str = Field(default="", alias="AI_MODEL")
    embedding_model: str = Field(default="", alias="EMBEDDING_MODEL")
    jwt_secret: str = Field(default="", alias="JWT_SECRET")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()