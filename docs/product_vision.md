# Product Vision

## Working name

Zenith is a planning and coordination platform for allocating labor, equipment, materials, and time against real operational needs.

## Core thesis

Most organizations plan badly because the information needed to make good decisions is fragmented:

- demand lives in tickets, spreadsheets, or ad hoc requests
- worker capability lives in HR systems and tribal knowledge
- capacity lives in calendars and manager intuition
- materials and equipment live in separate operational systems
- priorities are implicit, political, or unstable

Zenith should unify those inputs into one planning system that can:

1. represent needs in structured form
2. represent available capacity and constraints
3. generate candidate plans
4. explain why those plans were chosen
5. track outcomes and improve future plans

## The problem we are solving

The existing prototype solves a trivial sub-problem: "Which worker looks like a good fit for a role?"

The real problem is broader:

"How do we coordinate scarce resources across competing needs over time, under constraints, with visibility into tradeoffs and outcomes?"

That problem exists in:

- municipalities and public works systems
- hospital staffing and clinical operations
- manufacturing plants and distributed production networks
- logistics and warehousing
- cooperative business networks
- maintenance-heavy infrastructure organizations

## Product definition

Zenith is not a job-board matcher. It is not a macroeconomic simulator on day one either.

Zenith should become a layered planning system:

### Layer 1: operational planning

Plan work over hours, days, and weeks:

- assign people to tasks
- balance workloads
- schedule shifts
- reserve equipment
- check material availability
- surface bottlenecks

### Layer 2: tactical coordination

Plan across teams, facilities, or regions over weeks and months:

- compare scenarios
- move work between units
- identify shortages
- prioritize strategic projects
- model tradeoffs between throughput, cost, service levels, and resilience

### Layer 3: network-level coordination

Coordinate activity across an ecosystem rather than one organization:

- federated demand signals
- shared capacity pools
- inter-unit dependencies
- regional or sector-wide planning views
- explicit governance and auditability

The first serious implementation should focus on Layer 1 and the minimum infrastructure needed to grow into Layer 2.

## Vision statement

Zenith should become the control layer for real-world planning: a system where demand, capacity, constraints, and priorities meet, and where proposed plans can be evaluated, approved, executed, and learned from.

## Initial product wedge

The best first version is not "plan an economy." It is:

"A multi-site labor and resource planning platform for organizations with recurring operational work."

That wedge is large enough to matter and narrow enough to build.

Examples:

- city maintenance departments coordinating crews, vehicles, and work orders
- hospital operations teams coordinating staff, rooms, and equipment
- warehouse networks balancing labor, shifts, and outbound demand
- manufacturing groups assigning operators, machines, and jobs

## Primary users

### Operations planners

Need to turn demand into workable schedules and allocations.

### Team leads and dispatchers

Need to adjust assignments during execution and report changes quickly.

### Managers and executives

Need visibility into utilization, bottlenecks, service levels, shortages, and scenario tradeoffs.

### Workers and operators

Need clear assignments, eligibility checks, and predictable schedules.

### Policy or governance actors

In later stages, need transparent reasoning, audit trails, and override mechanisms.

## Product principles

### Advisory before autonomous

Zenith should recommend first, not silently impose. Approval and override must exist from the start.

### Structured data over free text

A planning system cannot depend on loose strings. Core inputs must be represented as explicit entities.

### Hard constraints and soft objectives

The system must distinguish between things it may never violate and things it should optimize.

### Versioned scenarios

Users need to compare plans, not just generate one answer.

### Explainability

Every recommendation must be inspectable:

- why this worker
- why this site
- which constraints bound the result
- what tradeoffs were made

### Closed-loop planning

Planned work and actual execution must be connected. Otherwise the system never learns.

## Concrete v1 scope

The first real product should support:

- organizations with multiple locations or operating units
- workers with structured skills, certifications, availability, and home sites
- tasks or work orders with deadlines, durations, priorities, and requirements
- facilities, equipment, and material availability as first-class constraints
- plan generation over a daily and weekly horizon
- manual review and approval of generated plans
- plan vs actual tracking
- scenario comparison for alternative allocations

## v1 non-goals

The first version should not attempt:

- national-scale economic planning
- price-system replacement
- full ERP replacement
- autonomous long-horizon procurement planning
- complex forecasting across dozens of domains
- fully automated decision-making without human review

Those are later-system concerns.

## What makes Zenith distinct

Zenith should combine five things that are often split across separate tools:

1. demand intake
2. workforce and resource capability modeling
3. constrained planning and scheduling
4. scenario analysis
5. execution feedback and governance

Most tools cover only one or two of these.

## Success metrics

The product should be evaluated against operational outcomes, not just software activity.

### Planning quality

- percent of work orders assigned within SLA
- percent of plans requiring manual rework
- utilization rate by worker, team, facility, and equipment class
- overtime reduction
- travel time reduction
- backlog reduction

### Decision quality

- constraint violation rate
- plan stability after publication
- forecast vs actual variance
- shortage detection lead time

### Organizational trust

- approval rate of generated plans
- override reasons by category
- time-to-explain recommendations

## Long-term ambition

If Zenith succeeds at the operational layer, it can become part of a broader economic coordination stack:

- local planning units publish needs and capacities
- upstream and downstream dependencies become visible
- shared constraints and bottlenecks are modeled explicitly
- priorities can be negotiated rather than guessed
- planning becomes iterative, transparent, and measurable

That is the meaningful route from a toy matching tool to a serious economic planning system.
