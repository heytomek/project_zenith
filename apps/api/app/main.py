from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.routes.demand import router as demand_router
from app.api.routes.health import router as health_router
from app.api.routes.organizations import router as organizations_router
from app.api.routes.plans import router as plans_router
from app.api.routes.resources import router as resources_router
from app.api.routes.roles import router as roles_router
from app.api.routes.workforce import router as workforce_router
from app.config import get_settings
from app.db import models  # noqa: F401
from app.services.errors import ServiceError


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version=settings.app_version)

    @app.exception_handler(ServiceError)
    async def service_error_handler(_: Request, exc: ServiceError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.get("/")
    def root() -> dict[str, str]:
        return {
            "service": "zenith-api",
            "version": settings.app_version,
            "docs": "/docs",
        }

    app.include_router(health_router, prefix=settings.api_v1_prefix, tags=["health"])
    app.include_router(demand_router, prefix=settings.api_v1_prefix, tags=["demand"])
    app.include_router(plans_router, prefix=settings.api_v1_prefix, tags=["plans"])
    app.include_router(resources_router, prefix=settings.api_v1_prefix, tags=["resources"])
    app.include_router(organizations_router, prefix=settings.api_v1_prefix, tags=["organizations"])
    app.include_router(roles_router, prefix=settings.api_v1_prefix, tags=["roles"])
    app.include_router(workforce_router, prefix=settings.api_v1_prefix, tags=["workforce"])
    return app


app = create_app()
