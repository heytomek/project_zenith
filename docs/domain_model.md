# Domain Model

## Purpose

This document defines the concrete entities and planning concepts Zenith must represent.

The goal is to move from loose text matching to a structured planning model that supports:

- allocation
- scheduling
- coordination
- simulation
- feedback

## Modeling principles

### Canonical entities first

All planning should run on explicit entities with identifiers, relationships, and states.

### Time is first-class

Capacity and demand only make sense in relation to time windows, deadlines, and planning horizons.

### Constraints are explicit

Do not hide rules in code branches or user intuition. Model them directly.

### Plans are versioned artifacts

A plan is not just a screen state. It is a persisted, reviewable object with inputs, outputs, and assumptions.

## Planning levels

Zenith should support three nested levels of planning.

### Strategic

Quarterly and annual questions:

- capacity expansion
- hiring needs
- training pipeline gaps
- facility investments
- major capital allocation

### Tactical

Weekly and monthly questions:

- how to distribute work across units
- how to cover shortages
- what scenarios look feasible
- how to sequence medium-term projects

### Operational

Daily and shift-level questions:

- who does which task
- where they do it
- with what equipment
- in what sequence

## Core bounded contexts

The domain splits cleanly into the following contexts:

1. organization and geography
2. workforce capability and availability
3. demand and work definition
4. physical resources and inventory
5. planning rules and optimization
6. execution and outcomes

## Core entities

The tables below define the concrete entities for the new system.

## 1. Organization and geography

| Entity | Purpose | Required core fields |
| --- | --- | --- |
| `Organization` | Top-level tenant or operating body | `id`, `name`, `type`, `status` |
| `PlanningUnit` | Team, department, facility group, district, or business unit | `id`, `organization_id`, `name`, `unit_type`, `parent_unit_id` |
| `Location` | Physical site or service area | `id`, `organization_id`, `name`, `location_type`, `timezone`, `lat`, `lng` |
| `Region` | Logical grouping for cross-site planning | `id`, `organization_id`, `name`, `parent_region_id` |

Relationships:

- an `Organization` has many `PlanningUnit`s
- a `PlanningUnit` may belong to a parent `PlanningUnit`
- a `Location` belongs to an `Organization` and may map to one or more `PlanningUnit`s
- a `Region` groups locations and units for reporting and coordination

## 2. Workforce capability and availability

| Entity | Purpose | Required core fields |
| --- | --- | --- |
| `Worker` | A person available for assignments | `id`, `organization_id`, `display_name`, `employment_type`, `status`, `home_location_id`, `home_unit_id` |
| `Skill` | A normalized capability | `id`, `organization_id`, `code`, `name`, `category` |
| `WorkerSkill` | A worker's level in a skill | `id`, `worker_id`, `skill_id`, `proficiency_level`, `verified`, `source` |
| `Certification` | Credential required for some work | `id`, `organization_id`, `code`, `name`, `expires` |
| `WorkerCertification` | Worker credential state | `id`, `worker_id`, `certification_id`, `status`, `issued_at`, `expires_at` |
| `AvailabilityCalendar` | Repeating and ad hoc worker availability | `id`, `worker_id`, `timezone`, `effective_from`, `effective_to` |
| `AvailabilityWindow` | Specific available or unavailable interval | `id`, `calendar_id`, `start_at`, `end_at`, `availability_type` |
| `ShiftTemplate` | Standard shift definitions | `id`, `organization_id`, `name`, `start_local_time`, `end_local_time` |
| `LeaveRequest` | Approved or pending time off | `id`, `worker_id`, `start_at`, `end_at`, `status`, `reason_code` |

Important planning rules:

- worker availability is the result of recurring calendars, leave, and existing assignments
- certifications can act as hard eligibility constraints
- skills should support levels, not binary tags

## 3. Demand and work definition

| Entity | Purpose | Required core fields |
| --- | --- | --- |
| `DemandSignal` | A unit of incoming need | `id`, `organization_id`, `source_type`, `source_ref`, `requested_at`, `priority`, `status` |
| `TaskTemplate` | Reusable blueprint for work | `id`, `organization_id`, `name`, `category`, `default_duration_minutes`, `default_priority` |
| `WorkOrder` | A concrete planning item to be fulfilled | `id`, `organization_id`, `task_template_id`, `title`, `status`, `priority`, `requested_start_at`, `due_at`, `location_id` |
| `WorkRequirement` | Structured requirement for a work order | `id`, `work_order_id`, `requirement_type`, `reference_id`, `min_level`, `quantity` |
| `Dependency` | Ordering or blocking rule between work items | `id`, `predecessor_work_order_id`, `successor_work_order_id`, `dependency_type` |
| `ServiceLevelPolicy` | Target completion windows by work class | `id`, `organization_id`, `name`, `scope`, `target_minutes` |

`WorkRequirement` should support multiple requirement types:

- `skill`
- `certification`
- `equipment_type`
- `material`
- `headcount`
- `location_access`

## 4. Physical resources and inventory

| Entity | Purpose | Required core fields |
| --- | --- | --- |
| `Facility` | A plant, warehouse, clinic, depot, or office | `id`, `organization_id`, `location_id`, `name`, `facility_type`, `status` |
| `EquipmentType` | Class of equipment or vehicle | `id`, `organization_id`, `code`, `name`, `category` |
| `Equipment` | A specific machine, vehicle, or tool | `id`, `organization_id`, `equipment_type_id`, `facility_id`, `status`, `serial_number` |
| `EquipmentCalendar` | Availability and maintenance windows for equipment | `id`, `equipment_id`, `timezone` |
| `Material` | A stocked input or supply | `id`, `organization_id`, `sku`, `name`, `unit_of_measure`, `material_type` |
| `InventoryPosition` | On-hand quantity by location | `id`, `material_id`, `location_id`, `on_hand_qty`, `reserved_qty`, `available_qty` |
| `ResourceReservation` | Reservation of material or equipment against planned work | `id`, `resource_type`, `resource_id`, `work_order_id`, `start_at`, `end_at`, `quantity` |

Important planning rules:

- resource calendars must influence candidate allocations
- inventory availability should support both current and projected positions

## 5. Planning rules and optimization

| Entity | Purpose | Required core fields |
| --- | --- | --- |
| `PlanningHorizon` | Time window and granularity for a plan | `id`, `organization_id`, `name`, `start_at`, `end_at`, `bucket_minutes` |
| `ConstraintRule` | Hard or soft constraint definition | `id`, `organization_id`, `scope_type`, `constraint_kind`, `severity`, `expression` |
| `ObjectiveFunction` | Weighted planning objective | `id`, `organization_id`, `name`, `objective_type`, `weight`, `direction` |
| `Scenario` | Versioned planning input set | `id`, `organization_id`, `name`, `scenario_type`, `base_scenario_id`, `status` |
| `PlanRun` | Execution of the planning engine | `id`, `scenario_id`, `started_at`, `completed_at`, `status`, `engine_version` |
| `PlanArtifact` | Persisted output of a run | `id`, `plan_run_id`, `artifact_type`, `storage_ref`, `summary_json` |
| `PlanIssue` | Explainable problem found during planning | `id`, `plan_run_id`, `issue_type`, `severity`, `message`, `scope_type`, `scope_id` |

Examples of `ConstraintRule`:

- worker cannot exceed 40 hours in week
- worker must hold certification X for task category Y
- task must be completed before dependency successor starts
- equipment must be at same location unless transfer is planned
- travel time between assignments cannot exceed threshold

Examples of `ObjectiveFunction`:

- maximize demand coverage
- minimize overtime
- minimize travel time
- minimize backlog age
- balance workloads across workers or sites
- prioritize high-criticality work

## 6. Execution and outcomes

| Entity | Purpose | Required core fields |
| --- | --- | --- |
| `Assignment` | Planned assignment of worker to work | `id`, `plan_run_id`, `worker_id`, `work_order_id`, `start_at`, `end_at`, `assignment_status` |
| `CrewAssignment` | Grouped assignment for multi-person work | `id`, `plan_run_id`, `work_order_id`, `crew_size`, `status` |
| `DispatchEvent` | Publication or change of assignment | `id`, `assignment_id`, `event_type`, `occurred_at`, `actor_id` |
| `ExecutionEvent` | Real-world operational update | `id`, `work_order_id`, `event_type`, `occurred_at`, `payload_json` |
| `ActualsRecord` | Actual start, finish, duration, output, and variance | `id`, `work_order_id`, `actual_start_at`, `actual_end_at`, `actual_duration_minutes`, `variance_json` |
| `Override` | Human change to a generated plan | `id`, `plan_run_id`, `scope_type`, `scope_id`, `reason_code`, `reason_text`, `actor_id` |
| `OutcomeReview` | Structured review of whether a plan worked | `id`, `plan_run_id`, `reviewed_at`, `reviewer_id`, `summary`, `score` |

## Planning outputs

Every planning run should produce structured outputs, not just ranked lists.

Minimum output types:

- eligible candidate sets by work order
- chosen assignments
- unassigned work with reasons
- violated soft constraints
- resource bottlenecks
- workload summaries by worker, unit, and site
- scenario comparison metrics

## Core relationships

The domain graph should center on these relationships:

- a `WorkOrder` belongs to a `Location` and may belong to a `PlanningUnit`
- a `WorkOrder` has many `WorkRequirement`s
- a `Worker` has many `WorkerSkill`s and `WorkerCertification`s
- a `Worker` has availability windows and may have existing assignments
- an `Assignment` links a `Worker` to a `WorkOrder`
- a `Scenario` owns many `PlanRun`s
- a `PlanRun` produces assignments, issues, and artifacts

## Planning workflow

The system should support a stable planning workflow.

### 1. Intake

Demand enters as work orders, projects, cases, tickets, or imported system records.

### 2. Normalization

Zenith resolves required skills, durations, locations, deadlines, and dependencies into canonical form.

### 3. Candidate generation

The planner narrows feasible workers, crews, facilities, and equipment using hard eligibility rules.

### 4. Optimization

The engine chooses a set of assignments and reservations using declared objectives and constraints.

### 5. Review and approval

Human planners inspect issues, compare scenarios, and approve or override the result.

### 6. Dispatch and execution

Approved assignments become dispatchable work.

### 7. Feedback

Actual completion data is written back and compared to assumptions.

## Hard constraints vs soft constraints

This distinction must exist in the model and the UI.

### Hard constraints

Must never be violated:

- certification missing
- worker unavailable
- equipment under maintenance
- dependency unsatisfied
- shift overlap

### Soft constraints

May be violated if the plan explains and scores the tradeoff:

- minimize travel
- maintain team continuity
- balance workloads evenly
- reduce overtime
- prefer home site

## Prioritized v1 entity set

The full model above is larger than the first build. `v1` should prioritize:

- `Organization`
- `PlanningUnit`
- `Location`
- `Worker`
- `Skill`
- `WorkerSkill`
- `Certification`
- `WorkerCertification`
- `AvailabilityCalendar`
- `AvailabilityWindow`
- `WorkOrder`
- `WorkRequirement`
- `Facility`
- `Equipment`
- `Material`
- `InventoryPosition`
- `PlanningHorizon`
- `ConstraintRule`
- `ObjectiveFunction`
- `Scenario`
- `PlanRun`
- `Assignment`
- `Override`
- `ActualsRecord`

That set is enough to support a serious operational planning product without overbuilding.

## Example v1 planning question

"Given 380 work orders due this week across 6 sites, 94 workers with different skills and certifications, 18 vehicles, 4 critical material shortages, and overtime limits, what is the best assignment plan that maximizes on-time completion while minimizing overtime and travel?"

If Zenith cannot answer that kind of question, it is still too close to the original toy.
