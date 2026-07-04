from pydantic import BaseModel


class HealthResponse(BaseModel):
    service: str
    version: str
    environment: str
    database_backend: str
    configured_tables: list[str]
