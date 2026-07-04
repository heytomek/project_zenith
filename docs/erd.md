# Initial ERD

This ERD covers the prioritized `v1` entities from the domain model. It is intentionally narrower than the full conceptual model so the first migrations can stay manageable.

```mermaid
erDiagram
  Organization ||--o{ PlanningUnit : contains
  Organization ||--o{ Location : operates
  PlanningUnit ||--o{ Worker : groups
  Location ||--o{ Worker : homes
  Worker ||--o{ WorkerSkill : has
  Skill ||--o{ WorkerSkill : classifies
  Worker ||--o{ WorkerCertification : holds
  Certification ||--o{ WorkerCertification : qualifies
  Worker ||--o{ AvailabilityCalendar : owns
  AvailabilityCalendar ||--o{ AvailabilityWindow : contains
  Organization ||--o{ WorkOrder : receives
  Location ||--o{ WorkOrder : occurs_at
  WorkOrder ||--o{ WorkRequirement : requires
  Organization ||--o{ Facility : operates
  Facility ||--o{ Equipment : houses
  Organization ||--o{ Material : stocks
  Material ||--o{ InventoryPosition : tracks
  Location ||--o{ InventoryPosition : stores
  Organization ||--o{ Scenario : compares
  Scenario ||--o{ PlanRun : executes
  PlanRun ||--o{ Assignment : produces
  Worker ||--o{ Assignment : fulfills
  WorkOrder ||--o{ Assignment : satisfies
  PlanRun ||--o{ Override : records
  WorkOrder ||--o{ ActualsRecord : reports
```

## First migration groups

1. `identity` and `org`
2. `workforce`
3. `operations`
4. `planning`
5. `resources`
6. `execution`

That order keeps foreign-key dependencies straightforward and matches the roadmap.

