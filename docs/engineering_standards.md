# Engineering Standards

## Objective

These standards exist to keep Zenith coherent as it grows from a prototype into a planning platform.

## Runtime baseline

- Python `3.12+` for backend and planning services
- Node.js `25+` available locally
- Bun `1.3.x` as the JavaScript package manager and workspace runner
- PostgreSQL as the primary datastore
- Redis for queues and ephemeral coordination

## Repository conventions

- `apps/api` contains the FastAPI application and persistence boundary
- `apps/web` contains the operator-facing Next.js application
- `services/planner` contains planning and optimization logic
- `packages/schemas` contains shared Python DTOs and schema models
- `docs` contains product and system design
- `tests` contains integration and planner-level tests

## Code organization

- HTTP routes should only validate inputs, delegate work, and shape responses.
- Planning logic belongs in the planner service, not in the API layer.
- Shared request and response models belong in `packages/schemas`.
- Persistence models should not leak directly into the UI contract.

## Data conventions

- Use UUIDs for primary identifiers.
- Persist timestamps in UTC.
- Keep local timezone context on locations, shifts, and calendars.
- Version scenarios and treat plan runs as immutable results.
- Distinguish hard constraints from soft objectives in both code and storage.

## API standards

- Version all public HTTP routes under `/api/v1`.
- Use explicit response models.
- Return explainable failure messages for planning issues.
- Keep asynchronous plan execution separate from synchronous CRUD flows.

## Testing strategy

- unit tests for domain rules and normalization
- planner tests for eligibility, constraints, and objective behavior
- integration tests for API and persistence flows
- regression tests for known planning scenarios

## Migration discipline

- one conceptual change per migration when possible
- additive schema evolution by default
- backfills must be documented and repeatable
- no destructive migration without an explicit data transition plan

## Documentation discipline

- update the domain model when adding first-class entities
- update the roadmap when changing phase scope
- write down new planning assumptions before coding them

