from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings, is_sqlite_url


def _engine_kwargs(database_url: str) -> dict:
    settings = get_settings()
    kwargs: dict = {
        "echo": settings.database_echo,
        "pool_pre_ping": settings.database_pool_pre_ping,
        "future": True,
    }
    if is_sqlite_url(database_url):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_size"] = settings.database_pool_size
        kwargs["max_overflow"] = settings.database_max_overflow
    return kwargs


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(settings.database_url, **_engine_kwargs(settings.database_url))


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, expire_on_commit=False)


def get_db_session() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
