from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    app_name: str = "Taste Report API"
    api_prefix: str = "/api"
    frontend_origins: str = "http://localhost:5173"
    openai_api_key: str | None = None
    wikimedia_user_agent: str = "TasteReport/0.1 (local-development)"
    catalog_timeout_seconds: float = 8.0
    catalog_max_retries: int = 1

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

