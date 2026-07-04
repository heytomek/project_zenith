# Contributing

## Purpose

Project Zenith is being rebuilt from a prototype into a planning platform. Contributions should strengthen the structured planning model, not add ad hoc features around the old script.

## Repository shape

The rewrite uses a monorepo layout:

- `apps/api`: FastAPI application and HTTP surface
- `apps/web`: Next.js operator interface
- `services/planner`: planning engine and solver integration
- `packages/schemas`: shared Python schemas and DTOs
- `infra/docker`: local development services
- `tests`: integration and planner-focused tests
- `docs`: product, domain, architecture, and implementation design

## Development standards

- Keep business rules out of route handlers and UI components.
- Model constraints explicitly in domain code instead of burying them in conditionals.
- Use UTC for persisted timestamps and keep timezone metadata on locations and calendars.
- Treat plan runs as immutable artifacts once completed.
- Prefer additive migrations; never rewrite applied migrations.

## Python

- Target Python `3.12+` for the rewrite.
- Use `ruff` for formatting and linting.
- Use `pytest` for tests.
- Keep application settings in typed settings objects, not module globals.

## Web

- Use TypeScript with strict settings.
- Keep the UI focused on planning workflows, not generic dashboard decoration.
- Prefer server-friendly data loading patterns and typed API boundaries.

## Workflow

1. Start from the docs in [`docs/README.md`](./docs/README.md).
2. Update the domain model when introducing a new first-class planning concept.
3. Add or update tests for planner behavior when changing constraints or objective logic.
4. Document migration impact when changing persisted planning entities.

## Pull request expectations

Every meaningful change should answer:

- what planning problem it solves
- which entities or workflows it changes
- which constraints or assumptions it introduces
- how it was verified

