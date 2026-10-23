"""Application settings loaded from environment variables."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ directory, used to resolve the default database and .env file
# regardless of the current working directory.
BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_URL = f"sqlite:///{(BASE_DIR / 'lifeline.db').as_posix()}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Lifeline API"
    APP_VERSION: str = "0.2.0"
    DATABASE_URL: str = DEFAULT_DATABASE_URL
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Demo credentials are configured through the environment. They must never
    # be committed to source control or returned by the API.
    COORDINATOR_API_KEY: str = ""
    VOLUNTEER_API_KEY: str = ""
    DEMO_COORDINATOR_NAME: str = "Demo Coordinator"
    DEMO_VOLUNTEER_NAME: str = "Demo Volunteer"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
