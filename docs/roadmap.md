# Zenith: strategic coordination build sequence

Updated October 4, 2026. [Product direction](product_vision.md): a strategic coordination layer for accountable human decision makers and specialist agents. Its purpose is to understand a changing situation, compare consequential courses of action, delegate bounded authority and learn from results across nested scopes. Small demonstrations test this architecture; they do not define the product as a maintenance tool.

## Current implementation

The application remains the local Alder calculator and decision journal described in [mvp.md](mvp.md). It computes a deterministic repair model, retains assumptions and stress comparisons, freezes decision versions, records observations and verifies portable exports. Its named team and source documents are synthetic fixture content. There is no connected world model, strategic portfolio engine, authenticated delegation or agent runtime. [Design QA](../design-qa.md) records interface and model checks, not evidence for those proposed capabilities.

## 1. Make the foundation executable

Translate the owner's [endstate](endstate.md) into explicit, revisable decision rules: durable flourishing and relief of involuntary suffering as ends; agency, ecological limits and legible, revocable power as protections; truthfulness, uncertainty and preserved options as requirements for reasoning. These rules must appear in objectives, constraints, authority and review, rather than only in a mission statement. Different participants can disagree about values and causal claims without the system collapsing them into one hidden score.

Define the first version of the shared contract:

| Primitive | Required behavior |
| --- | --- |
| Scope | A decision boundary with accountable authority, participants, time horizon and containment or overlap relationships. Nesting grants no authority. A child cannot silently claim a parent's authority or another scope's resources. |
| Objective | Desired outcomes, affected parties, observable measures and protected conditions. Distinguish hard protections from preferences; retain unresolved value conflicts. |
| Claim | A dated assertion with source provenance, units, scope, epistemic state and revision history. Distinguish observation, inference, forecast and assumption. Conflicting sources remain inspectable. |
| Capability | A provider's available capacity, timing, resource requirements and conditions of use, including existing commitments and one underlying resource identity across scopes. |
| Intervention | A proposed causal change with dependencies, resource demands, expected effects, alternatives and uncertainty. |
| Mandate | A delegated purpose, recipient, allowed actions, resource ceiling, scope, expiry, escalation conditions and revocation state. An instruction alone does not establish authority. |
| Outcome | A versioned prediction or observation tied to an objective, intervention and review horizon. Preserve the frozen expectation when new evidence changes the forecast. |

Human views and machine clients use the same identified objects and revisions. Scope relationships, source versions and commitments must be queryable. Overlapping scopes can share a capability without owning each other, and aggregation cannot count that capability twice. Begin with typed records and explicit links; storage technology does not prove that these semantics work.

Supporting contracts include reproducible model/run manifests and durable decision events. A decision event identifies its accountable authority, selected portfolio, frozen input/model/run references, authorized mandates, disagreement and review triggers. These contracts connect reasoning to an authorization boundary without adding another top-level primitive.

Acceptance: a published schema and coherent fixtures connect every candidate intervention to objectives, claims, dependencies and required capabilities; every mandate identifies the granting authority and boundaries; every reported outcome has an inspectable basis. All units and time intervals are explicit. The existing three-slider model stays a separate historical demonstration until this contract is verified.

## 2. Build one complete strategic loop

Use a synthetic regional transition spanning energy, housing and workforce development. The top-level question is which investment sequence should reduce household energy insecurity, strengthen energy resilience and build durable local capability under shared capital and workforce limits. It must also expose distributional effects and protected conditions, including consent and displacement risk. This is a worked strategic decision, not a claim that Zenith has validated the region's outcomes.

The fixture contains a regional scope, three program scopes and several delivery scopes, including one independently governed provider participating through an overlapping scope. It draws on distinct source snapshots: energy demand and network capacity; housing condition and household exposure; capital commitments; training cohorts and qualified workforce availability; project lead times; and relevant protections. Include a stale source, conflicting estimates and one important unmeasured effect. Store explicit source dates and uncertainty rather than manufacturing confidence.

Compare three strategies with the same inputs:

1. **Supply first:** prioritize energy infrastructure, with housing interventions following enabling capacity.
2. **Demand first:** prioritize housing efficiency and household exposure, with energy investment staged later.
3. **Coordinated transition:** sequence training, housing and energy investments together to use shared capacity and preserve future options.

Use a twelve-month resource commitment horizon and a thirty-six-month outcome horizon. The fixture must make at least one shared budget or workforce constraint bind, one intervention depend on another's completion and one portfolio infeasible. Report the violated constraint and affected interventions. Compare feasible portfolios across outcomes, costs, distribution, timing, uncertainty and reversibility; do not present a universal winner where objectives conflict.

Implement actual resource accounting, dependency evaluation and small portfolio enumeration before adding a general solver. A changed source must change the feasible set or forecast where its modeled relation warrants it. Causal effects without sufficient evidence remain labeled assumptions; a mathematically feasible portfolio is not proof of social benefit.

The complete loop is:

1. Ingest and validate heterogeneous source snapshots into the scoped model.
2. Identify important changes, conflicts, unknowns and binding capabilities.
3. Compute and compare intervention portfolios against declared objectives and protections.
4. Have the accountable human select a course and retain the tradeoff and conditions for revisiting it.
5. Issue bounded mandates to energy, housing, workforce and evidence-review specialist clients; acceptance checks and reserves authorized capacity atomically against the common resource ledger.
6. Record acknowledgement, proposed or completed actions, resource consumption and exceptions.
7. Reconcile observed outcomes against frozen expectations, revise relevant claims and require a decision when the mandate's bounds no longer permit continuation.

First use simulated machine clients with deterministic messages. Label simulated execution and synthetic outcomes throughout the trace. The coordinator must still enforce scope, revision, expiry, revocation, resource ceilings and allowed actions in code; clients obeying a written prompt is insufficient. Concurrent acceptance must not over-reserve shared capacity. Revocation releases only unconsumed reservations after an acknowledged stop or handover; in-flight commitments remain accounted for. Real autonomous agents and external writeback are later integrations, not implied by this demonstration.

Acceptance: the demonstration moves from source snapshots to three computed strategies, an approved portfolio, acknowledged mandates and a reviewed outcome without manual rewriting between steps. A resource shock or dependency failure creates a concrete exception: the specialist cannot simply expand spending or borrow another program's authority. The human sees the affected objective, available options, uncertainty and the decision required; the resulting revision updates commitments and mandates consistently.

## 3. Verify coordination, not only presentation

Apply the [validation protocol](usefulness-test.md) to both human decisions and machine contracts. Run deterministic tests for shared capacity, time buckets, unit conversion, dependencies, protected conditions, duplicate commitments, stale revisions, acknowledgement, expiry, revocation and out-of-scope actions. The trace must explain accepted and rejected actions from the stored authority and model version.

Ask senior decision makers to reconstruct a consequential multi-program decision using authorized source extracts. Run this research alongside the synthetic build; do not make the absence of an existing competitor a prerequisite. Evaluate whether the model makes the situation, tradeoffs, commitments and reasons to change course clearer, and whether specialist clients can operate within the same contracts without needing the human interface.

Acceptance: participants can identify the objective, binding constraint, relevant uncertainty, authority boundary and intervention requiring their judgment without developer explanation. Test actual changes to decisions and review effort against the existing process; a favorable reaction or a cleaner screen does not establish value. No outreach or partner access has been performed by writing this roadmap.

## 4. Connect real sources and bounded agents

Replace one simulated source and one simulated specialist at a time while retaining the same contract tests. Add authenticated principals, server-side authorization, durable transactional reservations, idempotent messages, durable action traces and recovery before shared live commitments. Incorporate external permissions and execution acknowledgements; displaying a mandate is not execution.

A bounded pilot should involve an accountable decision owner, more than one interacting program and an authorized set of external actions. Compare predictions with observed results and preserve the explanation for changed expectations. Hosting, production writeback and external agent actions require their applicable authorization; the local demonstration creates none of those permissions.

Acceptance: the same decision can be replayed from its input versions; delegated actions respect live policy; interruption and retry do not duplicate commitments; revoked authority prevents subsequent actions within the declared enforcement boundary. Measure decision preparation and review effort, constraint failures, outcome error and whether the chosen strategy changed for a defensible reason.

## 5. Expand by nesting and federation

Extend the same primitives across organizations and larger decision horizons. Add cross-scope capability offers, conditional commitments, negotiated dependencies and explicit responsibility for joint outcomes. Preserve overlapping relationships as well as containment; one provider may participate in several programs through the same underlying resource identity. Local participants retain the authority to refuse or revoke an offer under its recorded terms. A higher scope can aggregate evidence and compare coordination options without inventing control over lower scopes.

The long-term product supports institutional and regional self-direction: humans choose ends and consequential tradeoffs; agents continually gather evidence, explore interventions, carry out bounded mandates and surface decisions requiring broader authority. Scaled-down use employs the same contracts with fewer scopes and simpler models.

Acceptance: compare independent and coordinated strategies using declared terms and available evidence. Demonstrate an improvement that survives actual execution and review, or retain the independent choice. Progress does not require monopolizing functions already served by other products; it requires delivering a better strategic decision and coordination loop.

## Boundaries

Do not build a dispatch interface, generic dashboard, ontology editor or organization administration suite as a substitute for the strategic loop. Do not hide moral conflicts inside objective weights, infer consent, present synthetic results as observed benefits or describe unimplemented policy as enforced. Broader models, solvers and agent integrations should extend a verified contract rather than become disconnected feature collections.
