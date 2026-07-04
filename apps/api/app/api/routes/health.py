from fastapi import APIRouter
from zenith_schemas.health import HealthResponse

from app.config import get_settings
from app.db.base import Base

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(
        service="zenith-api",
        version=settings.app_version,
        environment=settings.env,
        database_backend=settings.database_url.split(":", maxsplit=1)[0],
        configured_tables=sorted(Base.metadata.tables.keys()),
    )
