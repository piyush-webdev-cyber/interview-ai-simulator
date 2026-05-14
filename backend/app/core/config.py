from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Interview AI Simulator"
    app_env: str = "development"
    require_auth: bool = True
    groq_api_key: str | None = None
    groq_model: str = "llama-3.1-8b-instant"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/interview_ai"
    sql_echo: bool = False
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_role_key: str | None = None
    allowed_origins: str | list[str] = ["http://localhost:8081", "http://localhost:19006"]

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()
