# Coordination domain model

updated November 2, 2026. `apps/web/lib/coordination/types.ts` and `project-data.ts` define the current contracts; `core.ts` validates and applies them. the [product vision](product_vision.md) supplies the philosophical foundation.

## Real-project source model

`Workspace.project?: ProjectData` identifies the imported-project path within the existing version-two library. its profile is a fixed review-only shell: no modeled objectives, claims, capability quantities, interventions, strategies or shocks are invented. project mode cannot carry simulated decisions, mandates, outcomes or events. its revision equals source refreshes plus appended responses; this is a command count, not business time.

| Record | Implemented meaning |
| --- | --- |
| `ProjectSnapshot` | immutable source identity, file name, report date, import time, columns, mapping and records |
| `ProjectRecord` | normalized commitment fields, stable ID, one-based data-record number and original string cells |
| `ProjectResponse` | appended human judgment with finding identity, evidence fingerprint, cited snapshot, review date and creation time |

`project-data.ts` parses CSV or JSON records, suggests mappings and validates every normalized record against the preserved cells and mapping. Title and Project are required. optional absent values remain explicit; units, dates, status and dependencies follow [the data contract](project-data.md). refresh supplies a complete source snapshot, preserving previous versions rather than overwriting them or merging partial row changes.

`reviewProject` in `project-review.ts` derives grouped deadline, budget, dependency and requested-decision findings from the current snapshot at a declared review date. the three reviewers execute local deterministic rules, not LLM inference or causal prediction. source coverage is a separate derived view. each response must reproduce against its cited snapshot and rule fingerprint; the fingerprint is for evidence continuity, not security or institutional authentication.

unchanged relevant finding facts can retain a reviewed response across refreshes. changed facts, a newly overdue condition, or a condition that disappears and later recurs reopen the question. a response records judgment; it cannot modify the source, mark external work complete or grant execution rights. existing modeled profiles and older portable files retain their own contracts below.

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

a `Strategy` selects a portfolio of existing interventions. catalogue records have no authored revision; user additions carry optional `authoredRevision`, the workspace command revision that introduced them. `addStrategy` includes unfinished prerequisites and appends a new record rather than rewriting an authorized portfolio. saving an infeasible alternative for comparison is permitted; authorizing it is not. An `Agent` declares explicit scopes and allowed actions. A `Shock` supplies a bounded alternative claim value. These are supporting records, not independent sources of authority.

Scopes can nest or overlap. Neither relationship grants access to another scope's resources. Capabilities and delegated actions must explicitly include the consuming scope.

## Knowledge and evaluation

Claims retain their original value and provenance; `Workspace.claimValues` stores current revisions. A decision freezes the values used at authorization. a contested source retains dissent even when its working value changes. `EvidenceSource` contains title, author, publication date and excerpt; `recordEvidence` appends this snapshot as `Event.evidence` with the new claim value. the original profile source remains unchanged. `currentClaimSource` returns the latest recorded source. this manual assertion is neither a live adapter nor verification of its truth.

Resource use and effects can scale by `current claim / scaleBase`. Dependencies form an acyclic graph. Effects count only when earliest completion lies inside the projection. Protected bounds are hard conditions; targets are goals rather than hidden feasibility constraints.

The evaluator returns resource demand/availability, objective changes, dependency timing, used assumptions and violations. It does not produce a universal score or decide whose goals deserve priority.

## Authority and history

a `Decision` records strategy, human authority, rationale, claim snapshot, evaluation and preceding commitments. new decisions also freeze optional `snapshot.executionPolicy` and `snapshot.completedInterventionIds`, recording which prerequisites had already completed at authorization. older version-two decisions without these optional fields retain their historical evaluation and replay semantics. new receipts use `source-window-v1`; current acceptance and execution reject a lead-time revision that invalidates previously in-horizon expected effects. unrelated mandates are not stopped by that timing condition.

only newly selected work receives a mandate with a frozen resource ceiling, expected effects, predecessor mandates and expiry. a completed prerequisite may belong to an earlier decision: its existing mandate becomes the predecessor reference. it is neither issued nor consumed twice; its spending remains committed and its observed effect remains in the current baseline. an explicitly repeated intervention still fails the duplicate-mandate check.

Mandate states are `proposed`, `accepted`, `running`, `blocked`, `stopping`, `revoked` and `completed`. Acceptance reserves capacity atomically. Consumption is retained when work finishes or stops; only acknowledged unconsumed reservations can be released.

events record claims, strategy additions, reviews, decisions, acceptance, progress, blocking, revocation, rejection and outcomes. `DecisionResponse` records decision ID, retain/investigate/stop action, rationale, reviewed revision and authority in `Event.review`. a retain/investigate receipt does not change the underlying condition, delegated scope or spending ceiling. stop requests retain unconsumed reservations until acknowledgment; completed observations and consumption remain. a `strategy` event includes its full `strategy` payload; replay requires the payload, appended profile record and authored revision to agree. a decision cannot use a strategy before its recorded addition. strict import validation reproduces evaluation and replays history to check the declared execution-policy boundary, evidence and response payloads, authority, capacity, completed prerequisites and consumption. old unmarked histories remain compatible rather than being silently assigned current execution semantics. neither those unsigned histories nor their checksums authenticate real institutional actions.

these optional fields preserve the version-two file boundary: older workspaces, bundled profiles and worked histories remain readable. a deliberately fresh instance retains the strategy catalogue while removing previous command-revision metadata; importing an existing workspace preserves its complete history.

## Derived reconsideration

`reviewDecision` keeps the authorized promise, the declared baseline plus recorded outcomes and reassessed remaining effects distinct. completed observations are counted once; unfinished progress consumes resources without inventing partial outcomes. changed claims are linked through declared dependencies to affected mandates, objectives and responsible stewards. capacity, timing, authority, protection and outcome issues remain separate dimensions.

`reviewWorld` filters related decision contexts across contained and overlapping scopes without granting additional rights. affected participants are identified by recorded scopes and stewards; this is not a consent or negotiation protocol.

response options use the existing catalogue as counterfactuals after acknowledged stopping, preserving spent resources and observations and charging full restart cost for unfinished work. feasibility requires the model's current bounds; actual action still requires a new authorization and planning window. a counterfactual does not preserve the original deadline or mechanically settle disagreement about ends.

## Containers

a modeled `Profile` holds the domain model, principles, projection horizon, synthetic sources, strategies and agents. a modeled `Workspace` adds current claims, revision/tick, decisions, mandates, outcomes and events. an imported workspace instead carries the validated `project` payload and review-only profile. a version-two `Library` stores both kinds of independent workspace and the active identity.

`inspectWorld` in `insights.ts` computes scoped phase, next action, attention and counts from the current workspace. these values are projections of the contracts, not another persisted workflow or decision record. resolved exceptions do not remain active because an old event still exists.

strategy selection, uncommitted rationale and composer input are tab-local session drafts outside `Library`. they can survive navigation and same-tab reload without becoming an authorization or entering a portable export.

`decisionEpisode` generates active synthetic Explore cases using authorize, accept, advance and sourced-evidence commands. the earlier completed `workedExample` histories remain available for compatibility. Begin starts fresh planning; existing stored worlds reopen without reseeding.

A new instance copies the complete profile into an independent workspace. It does not erase prior commitments and does not create additional real resources. Shared cross-workspace commitments require a later network model.

verification results and their dates are recorded in [current status](implementation_status.md), [testing](testing_guide.md) and [design QA](../design-qa.md).

The previous operational entity specification is retained [unchanged in the archive](archive/2026-10-04/domain_model.md).
