from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Zenith API"
    app_version: str = "0.1.0"
    env: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./zenith.db"
    database_echo: bool = False
    database_pool_pre_ping: bool = True
    database_pool_size: int = 5
    database_max_overflow: int = 10
    alembic_config_path: str = "apps/api/alembic.ini"
    cors_origins: list[str] = []
    default_timezone: str = "UTC"
    planner_mode: Literal["stub", "solver"] = "stub"

    model_config = SettingsConfigDict(env_prefix="ZENITH_", env_file=".env", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


def is_sqlite_url(database_url: str) -> bool:
    return database_url.startswith("sqlite")
