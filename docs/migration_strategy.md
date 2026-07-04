# Migration Strategy

## Goal

Create a durable schema evolution path for the rewrite without overcommitting to the entire long-term model at once.

## Principles

- start from the prioritized `v1` entities
- keep migrations additive
- separate schema introduction from data backfill
- document every non-trivial state transition

## Initial schema rollout

### Wave 1: organization foundation

- organizations
- users
- roles
- planning_units
- locations

### Wave 2: workforce foundation

- workers
- skills
- worker_skills
- certifications
- worker_certifications
- availability_calendars
- availability_windows

### Wave 3: demand model

- work_orders
- work_requirements
- dependencies

### Wave 4: planning model

- planning_horizons
- constraint_rules
- objective_functions
- scenarios
- plan_runs
- assignments
- overrides

### Wave 5: resource model

- facilities
- equipment
- materials
- inventory_positions
- resource_reservations

### Wave 6: execution feedback

- dispatch_events
- execution_events
- actuals_records
- outcome_reviews

## Data migration policy

- Raw imports should land in staging tables or importer payload logs before normalization.
- Backfills should be idempotent and documented in migration notes.
- Enumeration and status changes should prefer additive expansion before cleanup.

## Planner compatibility rule

The planner must declare the schema version or feature set it expects when executing a plan run. This prevents silent runtime drift between migrations and planning behavior.

## Migration review checklist

- Does the migration introduce a new first-class planning concept?
- Is the concept already defined in the domain model?
- Are timezones, audit fields, and lifecycle state represented correctly?
- Can existing plans remain queryable after the change?
- Is a backfill or defaulting strategy required?

