# Coordination domain model

Updated October 4, 2026. `apps/web/lib/coordination/types.ts` is the current contract; `core.ts` validates and applies it. The [product vision](product_vision.md) supplies the philosophical foundation.

## Primitives

| Primitive | Implemented meaning |
| --- | --- |
| Scope | A named context with a steward, optional parent and overlapping related scopes |
| Objective | A measurable end with unit, baseline, target, direction and optional protected bounds |
| Claim | A bounded numeric assertion with observed/assumed/contested status, dated source and possible dissent |
| Capability | An explicitly offered resource quantity, provider, period and authorized consumer scopes |
| Intervention | A proposed mechanism with scoped agent, prerequisites, resources, effects and lead time |
| Mandate | A frozen, revocable delegation with agent, scope, ceiling, dependencies, expiry and lifecycle |
| Outcome | An expected and observed effect tied to its mandate and accountable decision |

A `Strategy` selects a portfolio of interventions. An `Agent` declares explicit scopes and allowed actions. A `Shock` supplies a bounded alternative claim value. These are supporting records, not independent sources of authority.

Scopes can nest or overlap. Neither relationship grants access to another scope's resources. Capabilities and delegated actions must explicitly include the consuming scope.

## Knowledge and evaluation

Claims retain their original value and provenance; `Workspace.claimValues` stores current revisions. A decision freezes the values used at authorization. A contested source retains dissent even when its working value changes.

Resource use and effects can scale by `current claim / scaleBase`. Dependencies form an acyclic graph. Effects count only when earliest completion lies inside the projection. Protected bounds are hard conditions; targets are goals rather than hidden feasibility constraints.

The evaluator returns resource demand/availability, objective changes, dependency timing, used assumptions and violations. It does not produce a universal score or decide whose goals deserve priority.

## Authority and history

A `Decision` records strategy, human authority, rationale, claim snapshot, evaluation and preceding commitments. Each intervention receives a mandate with a frozen resource ceiling, expected effects, predecessor mandates and expiry.

Mandate states are `proposed`, `accepted`, `running`, `blocked`, `stopping`, `revoked` and `completed`. Acceptance reserves capacity atomically. Consumption is retained when work finishes or stops; only acknowledged unconsumed reservations can be released.

Events record claims, decisions, acceptance, progress, blocking, revocation, rejection and outcomes. Strict import validation reproduces evaluation and replays the history to reject fabricated authority, capacity or consumption.

## Containers

A `Profile` holds the domain model, principles, projection horizon, synthetic sources, strategies and agents. A `Workspace` adds current claims, revision/tick, decisions, mandates, outcomes and events. A version-two `Library` stores independent workspaces and the active identity.

A new instance copies the complete profile into an independent workspace. It does not erase prior commitments and does not create additional real resources. Shared cross-workspace commitments require a later network model.

The previous operational entity specification is retained [unchanged in the archive](archive/2026-10-04/domain_model.md).
