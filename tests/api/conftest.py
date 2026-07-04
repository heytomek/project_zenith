from collections.abc import Generator

import pytest
from app.api.dependencies import db_session_dependency
from app.db import models  # noqa: F401
from app.db.base import Base
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture()
def client(tmp_path) -> Generator[TestClient, None, None]:
    database_path = tmp_path / "api_test.sqlite3"
    engine = create_engine(
        f"sqlite:///{database_path}",
        connect_args={"check_same_thread": False},
        future=True,
    )
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)

    def override_session() -> Generator[Session, None, None]:
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[db_session_dependency] = override_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
