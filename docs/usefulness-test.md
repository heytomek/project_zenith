# Zenith strategic coordination validation

Current protocol · October 4, 2026. No external decision makers have been interviewed, no connected agents have been tested and no pilot has run. The current Alder application is a calculator and journal. This protocol validates the [proposed strategic coordination product](product_vision.md), not capabilities already demonstrated by that application.

## What must be shown

Zenith should help an accountable human understand a consequential situation, choose among strategic interventions, delegate within explicit authority and revise the course when evidence changes. Specialist agents should use the same scoped records to perform bounded work and report exceptions. Existing products covering some of these functions is acceptable; the test is whether Zenith produces a better usable loop, not whether every capability is absent elsewhere.

Use the [regional energy–housing–workforce demonstration](roadmap.md) for internal verification. Its data, specialist clients and outcomes are synthetic. Obtain permitted source extracts for later real decision reconstruction. Research outreach, recordings and access to partner systems are proposed activities; none has been performed or authorized by this document.

## 1. Senior decision-maker comprehension

Recruit five people unfamiliar with the implementation who have responsibility for strategy, investment or coordination across more than one program. Include at least one person accountable for the people affected by the decision and one familiar with delegating to automated systems. This small study diagnoses comprehension; it is not a representative market survey.

Give participants the synthetic scenario and the decision they own. Explain the fictional setting and scope of their authority, but do not explain how to use the interface. Ask them to complete the following tasks within fifteen minutes. Record time, help given, interpretation and consequential errors.

| Task | Neutral prompt | Pass condition |
| --- | --- | --- |
| Orient | “What decision are you responsible for, and what would count as a good outcome?” | Identifies the scope, objectives, affected parties and a protected condition; distinguishes modeled forecasts from observations. |
| Understand | “What is currently limiting the available choices?” | Finds a binding capability or dependency and the source supporting it. |
| Compare | “Which strategy would you choose, and what are you giving up?” | Explains an actual computed tradeoff, a distributional effect and an uncertainty; does not confuse a feasible portfolio with a proven benefit. |
| Challenge | “Which important claim would you want to check before committing?” | Finds its provenance, epistemic state and downstream effect; can test an alternative assumption. |
| Delegate | “Authorize the specialist to advance this choice without giving it unlimited discretion.” | Sets a scoped mandate with resources, allowed actions, expiry and escalation conditions; understands which actions remain outside its authority. |
| Respond | “A shared resource is now unavailable. What needs your decision?” | Distinguishes actions the specialist may take from changes requiring broader authority; chooses a response with visible consequences. |
| Review | “Did the intervention achieve what you expected, and should it continue?” | Compares an observation with the frozen prediction, identifies the resulting revision and changes or revokes the mandate when warranted. |

Ask what was unnecessary, which decision they would still take elsewhere, what they would distrust and what information is missing. Then repeat the delegation or exception task by keyboard and on a narrow screen. Record accessibility barriers separately from participant mistakes.

Initial acceptance target: at least four of five participants complete the orientation, comparison, delegation and exception tasks within fifteen minutes without developer explanation. No participant should believe a named synthetic agent is connected, that a forecast is an observed result or that a recorded decision grants real external authority. This is a design target, not an empirical result. Correct repeated failures before expanding the interface.

## 2. Machine contract and coordination correctness

Run simulated specialist clients against the coordinator's actual API and policy checks. A successful prose conversation is insufficient. Store requests, object revisions, policy decisions, acknowledgement and effects so each result can be replayed. The same tests must later run against real clients.

| Test | Required result |
| --- | --- |
| Source provenance and revision | Claims retain source identity, date, units and epistemic state. An old input snapshot reproduces the old comparison; new evidence creates a new version. |
| Conflicting evidence | Conflicting claims remain visible. Selecting one basis changes only modeled downstream effects and records the selection. |
| Shared capability | Concurrent or repeated requests cannot commit more capacity than the provider offers within the declared time intervals. Contained and overlapping scopes refer to the same underlying resource pool and cannot double-count it. |
| Decision boundary | The persistent decision event retains authority, selected portfolio, frozen input/model/run references, authorized mandates and review triggers; replay identifies the basis for each accepted action. |
| Dependencies | An intervention cannot claim an enabling result before the modeled predecessor is available; a delay propagates to affected choices and mandates. |
| Protected conditions | A violating portfolio is rejected or explicitly returned as infeasible. A hidden objective weight cannot trade away a hard protection. |
| Scoped authority | A child or specialist cannot expand its scope, consume another program's resources or grant authority it does not hold. Containment and overlap relationships alone confer no authority. |
| Mandate boundaries | Allowed actions, ceilings, expiry and escalation are enforced by the coordinator. Out-of-bounds actions are rejected with an inspectable reason. |
| Acknowledgement and duplication | An issued mandate remains unacknowledged until the recipient accepts it. Retries preserve one commitment and one recorded effect through idempotent identifiers. |
| Revocation and stale work | A revocation blocks subsequent actions at the declared enforcement boundary. A stale revision cannot overwrite a newer decision. Unconsumed reservations release only after an acknowledged stop or handover; in-flight external work retains its commitments and actual cancellation limits. |
| Resource shock | A shared-resource failure produces an exception showing the affected objective, downstream dependencies and feasible responses; the client cannot silently exceed its mandate. |
| Outcome review | New observations preserve the original prediction and attribution limits. A revised forecast does not rewrite earlier expectations or claim that correlation establishes causality. |

Acceptance: all deterministic cases pass, including adversarial requests that attempt to exceed scope or duplicate commitments. Report which components are simulated, which policies execute in code and which external effects remain unverified. Current Alder model tests do not satisfy these new contract gates.

## 3. Reconstruct actual strategic decisions

With willing senior decision owners, examine recent consequential choices involving at least two interacting programs, investment options or resource providers. Ask about the actual situation before showing the product: objectives, who can commit resources, affected parties, time horizon, alternatives considered, unavailable evidence, tools used, chosen course and conditions for changing it.

Request only authorized source extracts and the actual decision record. Map them to the primitives without erasing disagreement or treating an unavailable datum as zero. Reconstruct the choice using the information available at the time, then distinguish what later evidence would have changed. Ask participants to identify missing constraints, unjustified claims and commitments they would not authorize.

A practical initial target is three reconstructed decisions and one willing bounded pilot. This is a planning threshold, not market-size or demand evidence. A useful reconstruction must yield at least one defensible improvement in understanding, comparison, delegation or review, with an accountable owner willing to use the loop again. A competing product already doing a similar job does not automatically invalidate the objective; compare the complete process and outcomes.

## 4. Test repeated decision value

Run the first bounded pilot alongside the existing decision process. State the decision scope, permissible actions, observation window and review owner in advance. Use comparable records from the existing process; do not invent an improvement percentage. Track:

- Time spent assembling evidence, comparing strategies and reviewing exceptions.
- Missing or inconsistent claims found before commitment, and how they changed the decision.
- Commitment conflicts, unauthorized actions and failures to escalate within the declared enforcement boundary.
- Differences in the selected portfolio, their reasons and the tradeoffs accepted by the decision owner.
- Forecast error and observed outcomes against frozen expectations, including effects on affected groups and protected conditions.
- Whether the owner and specialist clients can repeat the loop with less manual reconstruction, and what resources the organization would commit to continued use.

A single before/after comparison cannot establish causal improvement in broad social outcomes. Report observed changes, uncertainty and alternative explanations separately. Where possible, predefine comparable decisions or stagger adoption to distinguish product effects from changed circumstances. A faster decision that silently weakens protections does not pass.

Continue when accountable users repeatedly gain a consequential improvement and the mandate/outcome contract supports actual execution and review. Revise the design when the strategic choice remains unclear, evidence cannot be traced, authority is implicit, exceptions require rebuilding the model elsewhere or reported benefits do not survive observation. Stop the pilot's external actions when its agreed limits are exceeded; preserve the evidence for revision.

## Results record

For each study or pilot, retain its date, participant role, authorized scope, source versions, baseline process, tasks, help provided, decisions, exceptions, observed results and limitations. Mark every unperformed check as pending. Link the results to the relevant contract and interface version so subsequent improvements can be assessed against the same decision.

## Historical scope

The earlier Alder demo-comprehension protocol and maintenance-operator validation direction are superseded by this strategic protocol. Their interface and model checks remain historical engineering evidence in [Design QA](../design-qa.md); they neither establish demand for this direction nor define its buyer. The Alder case remains useful for testing a small instance of the reasoning loop, while the regional demonstration exercises the hierarchy and delegated coordination the product now requires.
