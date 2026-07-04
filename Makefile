PYTHON=.venv/bin/python
PIP=.venv/bin/pip
PYTHONPATH_SHARED=packages/schemas/src:services/planner/src

.PHONY: install-python install-web api-dev api-dev-sqlite web-dev infra-up infra-down migrate migrate-sqlite-local db-current db-current-sqlite-local seed-demo seed-demo-sqlite test-planner test-api test-all

install-python:
	$(PIP) install -e packages/schemas -e services/planner -e apps/api pytest httpx ruff

install-web:
	bun install

api-dev:
	PYTHONPATH=$(PYTHONPATH_SHARED) $(PYTHON) -m uvicorn app.main:app --reload --app-dir apps/api

api-dev-sqlite:
	PYTHONPATH=$(PYTHONPATH_SHARED) ZENITH_DATABASE_URL=sqlite:///./zenith_local.db $(PYTHON) -m uvicorn app.main:app --reload --app-dir apps/api

web-dev:
	bun run --cwd apps/web dev

infra-up:
	docker compose -f infra/docker/compose.yml up -d

infra-down:
	docker compose -f infra/docker/compose.yml down

migrate:
	PYTHONPATH=$(PYTHONPATH_SHARED) $(PYTHON) -m alembic -c apps/api/alembic.ini upgrade head

migrate-sqlite-local:
	PYTHONPATH=$(PYTHONPATH_SHARED) ZENITH_DATABASE_URL=sqlite:///./zenith_local.db $(PYTHON) -m alembic -c apps/api/alembic.ini upgrade head

db-current:
	PYTHONPATH=$(PYTHONPATH_SHARED) $(PYTHON) -m alembic -c apps/api/alembic.ini current

db-current-sqlite-local:
	PYTHONPATH=$(PYTHONPATH_SHARED) ZENITH_DATABASE_URL=sqlite:///./zenith_local.db $(PYTHON) -m alembic -c apps/api/alembic.ini current

seed-demo:
	PYTHONPATH=$(PYTHONPATH_SHARED) $(PYTHON) scripts/seed_demo_data.py

seed-demo-sqlite: migrate-sqlite-local
	PYTHONPATH=$(PYTHONPATH_SHARED) ZENITH_DATABASE_URL=sqlite:///./zenith_local.db $(PYTHON) scripts/seed_demo_data.py --database-url sqlite:///./zenith_local.db

test-planner:
	PYTHONPATH=$(PYTHONPATH_SHARED) $(PYTHON) -m pytest tests/planner

test-api:
	PYTHONPATH=$(PYTHONPATH_SHARED) $(PYTHON) -m pytest tests/api

test-all:
	PYTHONPATH=$(PYTHONPATH_SHARED) $(PYTHON) -m pytest tests
