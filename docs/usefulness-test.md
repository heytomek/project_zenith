# Zenith usefulness validation

*proposed protocol · 2026.11.21 · status: pending empirical validation*

Zenith's purpose is to **keep authorized promises coherent as conditions change**. the intended system helps accountable humans and bounded agents understand a changing situation, compare strategic choices under explicit objectives and protections, coordinate commitments, and revise decisions when evidence changes.

the immediate validation question is narrower and testable: **can a person bring an authorized real project export into Zenith, identify which conditions deserve attention, understand the evidence behind them, record a defensible judgment, and repeat the review when the source changes?**

this protocol tests the implemented product before extending validation to strategic modeling, agent delegation, institutional coordination, and observed outcomes. success on the initial workflow is necessary evidence for that direction, not proof of the full vision.

## 1. current product and evidence boundary

as documented on 2026.11.02, the active application provides:

- **Bring project data:** CSV/JSON file or paste ingestion, explicit column mapping, preview, source preservation, and declared report dates.
- **Attention:** locally computed, source-backed questions concerning deadlines, budgets, dependencies, and explicit requests for decisions, grouped by project.
- **Sources:** immutable versions of imported records, normalized values, original cells, and source-coverage gaps.
- **Record:** appended human judgments associated with the reviewed source snapshot, finding, and review date.
- **Refresh:** complete replacement source snapshots, preserved earlier versions, automatic review, and reopening of changed or recurring conditions.

these reviewers are deterministic local rules, not LLMs. review runs on import, refresh, and opening, with date checks while the browser remains open. there are no live source connectors, external execution agents, authenticated decision owners, shared server persistence, or automatic institutional escalation.

the separate modeled coordination experience supports synthetic scopes, objectives, strategies, capabilities, mandates, and outcomes. Harbor, Meridian, and Open Atlas demonstrate this contract. real-project imports do not acquire synthetic effects, reservations, mandates, or execution authority.

the [implementation status](implementation_status.md) and [testing guide](testing_guide.md) report that the 2026.11.02 checkpoint passed 149 coordination tests with 1 899 assertions, 64 isolated WebKit checks, lint, TypeScript, and the production build. these are engineering results, not participant studies or proof of empirical decision usefulness.

**validation status:** no completed external participant study, authorized real-project pilot, or observed decision improvement is documented in the current evidence. all empirical targets in this protocol remain untested until a dated results record establishes otherwise.

## 2. what the initial validation must establish

the primary hypothesis is that source-backed review helps an accountable person notice consequential project conditions, understand their basis, and reach or revise a judgment with less reconstruction and no loss of decision quality.

five questions govern the initial study:

1. **coverage:** does Zenith surface the important conditions that its declared rules and supplied evidence can actually detect? what important conditions fall outside that boundary?
2. **comprehension:** can an unfamiliar user distinguish a supported finding from a source gap, an assumption, a forecast, or an observed result?
3. **actionability:** can a decision owner identify what needs attention, why it matters, who should respond, and what information is still needed?
4. **continuity:** do unchanged facts retain their reviewed state, while changed or recurring conditions trigger reconsideration without rewriting earlier judgments?
5. **practical value:** does the workflow improve a real review process sufficiently that an accountable user would choose to repeat it?

the unit of success is a defensible review of an actual commitment, not the number of notifications generated, the quantity of imported data, or a participant's favorable impression of the interface.

a valid outcome can be that no decision is currently justified. a correct source gap is preferable to a confident invented conclusion.

## 3. study design and evidence preparation

### Participants

initial target: **five participants**, including at least three people accountable for project or program decisions and two people responsible for preparing, reviewing, or maintaining project information.

recruit across at least three distinct real project contexts where feasible. include variation in technical familiarity and at least one participant who regularly handles dependencies between teams or programs. participants should not have developed the tested interface.

record each participant's role, decision scope, familiarity with the source, and ordinary review process. a named `owner` field in an import does not establish authenticated authority.

five participants are sufficient for an initial diagnostic study, not a representative estimate of market adoption or the frequency of failures. if fewer participate, classify results as preliminary rather than silently reducing the denominator.

### Authorized source material

obtain at least three permitted project exports, preferably from different workflows or organizations. use actual commitments, milestones, budgets, dependencies, and decision requests where present.

for at least one project, obtain a later complete snapshot with a genuinely later report date. if no second authorized snapshot exists, use a separately labeled synthetic refresh fixture to test continuity. never present a manually altered real export as a naturally observed change.

before testing:

1. document who authorized each export, its intended use, permitted participants, and retention requirements.
2. record source identity, report date, file format, mappings, and relevant coverage limitations.
3. remove unnecessary personal, commercial, or security-sensitive fields before import.
4. retain a restricted reference copy for verification, separate from the participant's working copy.
5. establish an independent list of source-supported conditions and important missing information before inspecting Zenith's findings.

the [project-data contract](project-data.md) defines valid input and refresh behavior. each source accepts at most 500 records, 64 columns, and 2 MB of UTF-8 input. project history retains at most eight snapshots and 500 responses; portable exports have their own 2 MB total limit. select sources within these boundaries and record any excluded records or information.

### Reference review

a project owner and an independent reviewer should inspect the source to construct a reference set. resolve disagreements explicitly, retaining disputed items where no defensible resolution exists.

classify each candidate condition as:

| Classification | Meaning |
| --- | --- |
| detectable condition | supported by declared fields and an implemented review rule |
| source-coverage gap | information required for a determination is absent, incomplete, ambiguous, or invalid |
| consequential but unsupported | potentially relevant to the decision, but outside current rule coverage or unavailable from the export |
| non-consequential finding | factually supported, but not worth a decision owner's attention under the stated review policy |
| disputed | reviewers disagree about facts, interpretation, significance, or required response |

do not use Zenith's output to construct the initial reference set. otherwise, the study risks counting the system's own assumptions as ground truth.

for each item, capture the source record IDs, applicable dates, expected rule, decision significance, and reason for classification. distinguish factual correctness from whether a real user considers the question worth reviewing.

### Comparison with the existing process

before participants use Zenith, ask how they currently review equivalent exports: spreadsheets, project-management tools, reports, meetings, messages, or direct requests.

where the cases permit a fair comparison, ask them to perform a comparable triage using their normal method. record elapsed time, findings, missed conditions, supporting evidence, and follow-up effort.

counterbalance task order or use distinct but comparable cases when possible. distinguish first-use learning time from repeat-review time. do not interpret an unmatched before/after comparison as causal proof of improvement.

## 4. participant tasks

provide a short neutral explanation of the study's purpose and the boundaries of the data. do not teach the participant which findings to select or where answers appear. allow ordinary interface labels and help text to guide use.

record elapsed time, clicks or navigation obstacles when relevant, assistance given, verbal interpretation, mistakes, and final decisions. stop tasks that risk unauthorized disclosure or access.

| Task | Neutral participant prompt | Evidence of success |
| --- | --- | --- |
| **T1. Bring evidence** | "Bring this project export into a new workspace and tell me what information Zenith has." | Imports the file or pasted data, sets the report date, correctly maps Title and Project, inspects optional mappings, and notices material omissions or errors. |
| **T2. Orient** | "What projects or commitments are represented here, and what deserves your attention first?" | Identifies relevant projects, distinguishes surfaced questions from source gaps, and selects defensible priorities without treating every alert as equally consequential. |
| **T3. Trace** | "Why is this question here? Show me the evidence behind it." | Finds the applicable rule, cited records, source date, original values, and any uncertainty needed to explain the finding. |
| **T4. Challenge** | "Which part of this would you verify before acting? What can you not conclude?" | Recognizes a missing field, stale datum, conflicting commitment, or unsupported inference. Does not turn absence into zero, completion, or proof of success. |
| **T5. Judge** | "What would you do about this, and what would you need before making a commitment?" | Records a reasoned judgment linked to the finding; distinguishes investigation, escalation, or a proposed decision from actual authorization or execution. |
| **T6. Revisit** | "Here is a newer complete report. What changed, and which questions need another judgment?" | Refreshes correctly, identifies unchanged reviewed conditions and changed or recurring conditions, and can inspect the earlier evidence and response. |
| **T7. Recover** | "Can you preserve this review and reopen it without losing its history?" | Uses the available export and reopening workflow, verifies retained sources and judgments, and understands local storage and replacement boundaries. |
| **T8. Critique** | "What important decision would you still make elsewhere, and what is missing from this review?" | Identifies unsupported decisions, organizational context, risks, source limitations, or functionality gaps without confusing planned capabilities with existing ones. |

allow approximately 30–40 minutes for the participant's Zenith tasks, adjusting for dataset size. record individual task times rather than enforcing a single rigid time limit that rewards superficial speed.

for T6, a real later export is preferred. use a disposable controlled fixture when testing edge cases that would be inappropriate to manufacture in actual records. disclose its synthetic nature to participants and keep the resulting evidence separate.

### Controlled continuity scenarios

exercise the following with disposable fixtures or explicitly authorized source versions:

- an unchanged finding stays Reviewed after a complete refresh.
- a changed relevant value reopens the finding.
- a condition that disappears and later recurs requires fresh review.
- an explicitly unfinished record becomes overdue as the review date advances.
- a missing status does not establish that overdue work remains unfinished.
- an absent budget, forecast, or dependency reference remains a gap, not zero, an invented delay, or assumed completion.
- a row missing from the latest complete snapshot is not marked completed.
- an earlier judgment remains linked to the source and condition on which it was made.
- an imported owner name or recorded judgment does not grant execution authority.

test date and format rejection, source limits, and replacement warnings through engineering regression as well. human participants need not independently reproduce every parser edge case.

### Interaction and accessibility

observe at least one keyboard-only task sequence and one narrow-screen sequence, including import, opening a finding, inspecting its basis, and recording a response.

record inaccessible controls, focus failures, unintended scrolling, missing labels, excessive navigation, confusing state changes, and information that becomes unavailable on a phone.

separate observed participant difficulties from automated browser checks. an automated accessibility or responsiveness pass does not establish that an unfamiliar person can complete the decision task.

## 5. measurements and acceptance criteria

the following are **provisional release-to-next-study thresholds**, chosen to make the first validation falsifiable. they are not historical measurements or population-level benchmarks. review the thresholds before collecting study outcomes, and preserve the original thresholds if later revisions are necessary.

### Primary measures

| Measure | Definition | Initial acceptance target |
| --- | --- | --- |
| **review comprehension** | participants who correctly orient, prioritize, trace evidence, and record an appropriately scoped judgment without substantive moderator instruction | at least 4/5 |
| **detectable-condition recall** | correctly surfaced conditions divided by all reference conditions detectable from the supplied fields under implemented rules | at least 90%; no missed critical condition |
| **finding precision** | correctly source-supported findings divided by all evaluated findings asserting a detectable condition | at least 80%; no fabricated critical claim |
| **attention relevance** | surfaced finding groups judged by the accountable owner to warrant review or investigation during the agreed review cadence | at least 70% of evaluated groups |
| **continuity correctness** | controlled unchanged, changed, recurring, and historical-source cases behaving according to the declared contract | 100% of required cases |
| **repeat-review effort** | time to inspect and respond to a later report, compared with a comparable existing-process review | median no slower than the baseline, with raw paired times reported |
| **voluntary repeat value** | accountable owners willing to use the workflow on a subsequent real report and able to name a concrete reason | at least 2/3 owners |

a condition is *critical* when an accountable owner determines before outcome scoring that missing or misrepresenting it could cause an unauthorized commitment, material operational harm, breach of a protected condition, or materially wrong strategic judgment. document the classification and its basis.

precision and recall evaluate the declared rule contract, not universal insight into a project. if the source contains no evaluable conditions, report the metric as **not evaluable**, not 100%.

a correctly triggered but low-value question counts as source-correct and potentially nonactionable. a consequential issue requiring an unsupported source field or causal inference counts as an uncovered product need, not an implementation false negative under the present rules. report both; neither should disappear into the other's denominator.

### Mandatory safeguards

acceptance additionally requires:

- zero silently altered source values or overwritten historical judgments.
- zero invented completion states, observations, external actions, or authorizations.
- zero unresolved critical misunderstandings that a recorded judgment constitutes executable authority.
- zero unauthorized data disclosures, retention violations, or use of unapproved project information.
- all required source references, report dates, and historical decision links remaining inspectable.

a safeguard failure blocks progression regardless of average scores. correct the issue, rerun the affected engineering checks, and conduct a targeted participant retest where comprehension or trust was implicated.

### Secondary diagnostic measures

record, without using them as substitute success criteria:

- import time, mapping corrections, and percentage of relevant fields covered.
- number of findings per project and per review cycle.
- counts of correct alerts, unsupported alerts, missed detectable conditions, source gaps, and consequential out-of-contract issues.
- median and range of time from a surfaced question to a defensible response.
- number and type of moderator interventions.
- number of previously unknown problems uncovered, with independent confirmation where possible.
- disagreements between source reviewers and accountable owners.
- participant confidence before and after source inspection, recorded separately from actual correctness.
- accessibility obstacles, unnecessary cognitive steps, and duplicate work.

do not collapse these measures into a single usefulness score. accuracy, effort, user agency, and the significance of a decision remain separate dimensions.

## 6. privacy, authorization, and research safeguards

### Before participation

obtain explicit informed consent for the study and separate permission for recording, screenshots, quotations, or use of feedback. participation must be voluntary, with the ability to skip questions, stop, or withdraw according to the agreed research procedure.

authorization to participate does not imply authorization to disclose an employer's data. obtain appropriate permission from the data owner for every real export and intended use.

collect the minimum data needed to test the review process. favor approved redacted or minimized exports. avoid credentials, secrets, personal contact details, unnecessary employee identifiers, and data concerning vulnerable or affected individuals unless specifically justified and authorized.

### During the study

use an isolated browser profile or test environment. do not import study material into an existing personal workspace containing unrelated user records.

the current application reviews imported records locally, but browser storage can persist after a tab closes. shared-device access, synced browser settings, downloaded exports, screenshots, recording software, and voluntarily opened `source_url` links create additional privacy considerations.

do not use an external LLM, third-party transcription service, live project connector, or remote analysis system on source contents without separate authorization and disclosure.

keep observations focused on task performance. redact names, contract values, and confidential project details from screenshots and notes wherever those details are not necessary to establish the finding.

### After participation

store raw authorized evidence only in an access-controlled location designated by the study owner, never in the public repository. retain a private mapping between pseudonymous session IDs and participant identities only when needed.

establish the retention period with the data owner before the session. as a default proposal, remove working copies, study downloads, and identifiable raw recordings within 30 days after verification unless a shorter requirement applies or explicitly authorized retention is necessary. preserve only minimized findings and non-sensitive aggregate results for longer-term comparison.

verify cleanup of the study browser profile, local application storage, downloaded exports, temporary files, and recording locations. deletion must be actually performed and checked; closing a browser or deleting a tab is insufficient.

respect source-owner restrictions, participant withdrawal rights, and applicable organizational privacy and security policies. document any exception or incident and suspend further data collection if its implications remain unresolved.

## 7. how to record actual validation results

create a dated, versioned study record for each execution. proposed location:

`docs/validation/YYYY-MM-DD-real-project-review.md`

the public repository should contain only sanitized summaries and permissible evidence references. private source materials and identifiable participant records must remain outside it.

each run records the exact tested application commit, protocol version, source contract, test environment, and the dated report snapshots. source versions may be identified with restricted dataset IDs or private content hashes; do not publish identifiers that reveal confidential material.

### Run template

**Run identification**

| Field | Value |
| --- | --- |
| study ID | pending |
| study date and location | not run |
| protocol version | proposed 2026.11.21 |
| application commit / build | not recorded |
| moderator / review owner | not assigned |
| participant count and roles | 0; recruitment pending |
| authorized dataset IDs and report dates | none |
| consent and data authorization references | not obtained |
| baseline process and comparison method | not recorded |
| environment / device / accessibility conditions | not recorded |

**Participant task observations**

| Session | Task | Result | Duration | Help | Source or evidence reference | Error / observation |
| --- | --- | --- | --- | --- | --- | --- |
| pending | T1–T8 | not run | — | — | — | — |

for each task, use `pass`, `partial`, `fail`, `not run`, or `not applicable`, with a short explanation. record expected behavior, observed behavior, participant interpretation, help provided, and any material source mismatch. a pass requires the task-specific condition, not merely reaching the next screen.

**Finding and error register**

| Finding ID | Case / source version | Expected | Observed | Classification | Severity | Correction / retest |
| --- | --- | --- | --- | --- | --- | --- |
| pending | — | — | — | — | — | — |

classifications should distinguish software defect, data/mapping error, false positive, false negative, source gap, consequential unsupported need, comprehension failure, accessibility issue, privacy incident, and research limitation.

use severity categories:

- **critical:** unauthorized action or disclosure, materially false claim, lost source history, or dangerous authority misunderstanding.
- **major:** a missed consequential in-scope issue, incorrect continuity, blocked essential task, or substantial distortion of a decision.
- **minor:** avoidable friction, confusing presentation, or recoverable error without material consequence.

record who confirmed a finding, its source basis, its proposed remedy, and whether a retest actually passed.

**Acceptance scorecard**

| Criterion | Target | Observed | Status |
| --- | --- | --- | --- |
| comprehension | at least 4/5 | — | not run |
| detectable-condition recall | at least 90%, zero critical misses | — | not run |
| source-supported precision | at least 80%, zero critical fabrication | — | not run |
| attention relevance | at least 70% | — | not run |
| continuity correctness | 100% required scenarios | — | not run |
| repeat-review effort | median no slower than baseline | — | not run |
| voluntary repeat value | at least 2/3 owners | — | not run |
| mandatory safeguards | zero failures | — | not run |

report numerator, denominator, and individual observations alongside every percentage. do not calculate a rate from an empty denominator or merge multiple groups into a misleading sample size.

### Evidence and interpretation

after each run, record:

**What actually happened:** completed tasks, observed findings, source-backed corrections, time measurements, participant judgments, and verification results.

**What remains uncertain:** missing source fields, reference-set disagreements, selection effects, baseline differences, moderator influence, possible learning effects, and outcomes that were not observed.

**What changed because of the review:** decisions to investigate, clarify, escalate, retain, or revise a commitment. distinguish an expressed intention from an action independently verified to have occurred.

**What should change in Zenith:** concrete interface, rule, source contract, policy, or architecture revisions, with a priority, responsible owner, and retest condition.

**What the study supports:** a bounded conclusion linked to this sample, dataset, software version, and observation window.

do not infer market demand from favorable interviews, or causal improvement in outcomes from a faster review. record negative findings and decisions not to proceed with the same care as successful results.

## 8. progression decisions

### Gate A: trustworthy real-source review

proceed only when required engineering regressions and the controlled continuity scenarios pass, the source-correctness thresholds are met, and no critical safeguard issue remains unresolved.

a parser that preserves data but hides material ambiguity does not pass. neither does a review that produces persuasive answers unsupported by its original source.

### Gate B: demonstrated participant usefulness

proceed to a broader real-project evaluation when the initial participant thresholds are met, accountable owners report specific repeatable value, and the observed review does not weaken an existing protection or obscure uncertainty.

if users cannot identify the next meaningful decision, diagnose whether the problem lies in source coverage, review rules, information hierarchy, decision ownership, or the underlying product job.

revise and retest the responsible part rather than compensating with additional alerts, summaries, or speculative AI features.

### Gate C: repeatable use across reporting cycles

for willing owners, observe subsequent authorized exports across multiple reporting cycles. compare source changes, reopened questions, effort, judgment continuity, and practical use against the existing process.

require evidence that a useful review can be repeated without rebuilding its context or quietly depending on the original moderator.

record whether a user actually returns and performs another review, separately from whether they say they intend to do so.

one successful study does not establish retention, causality, institutional fit, or suitability for autonomous execution.

## 9. strategic coordination validation: future track

the source-backed project review is an entry point into Zenith's larger strategic loop, not its final product boundary. the [product vision](product_vision.md) remains the governing hypothesis: humans and agents should share an evidence-based understanding of a changing world, compare coherent strategies under distinct values, make legitimate bounded commitments, and revise them against observations.

future validation should progressively test five activities:

| Strategic activity | Participant question | Required future demonstration |
| --- | --- | --- |
| **Understand** | "What are we trying to achieve, what is happening, and which claims are uncertain?" | scoped objectives, affected parties, dated evidence, protected conditions, and explicit epistemic limits |
| **Compare** | "Which intervention portfolio would you choose, what constrains it, and who bears the tradeoffs?" | actual declared alternatives, causal assumptions, resource feasibility, dependencies, and separate outcome dimensions |
| **Decide** | "What are you willing and entitled to authorize?" | attributable decision, frozen evidence, legitimate authority, resource envelope, exclusions, expiry, and review triggers |
| **Coordinate** | "What may each specialist do, and what requires another decision?" | enforced bounded mandates, acknowledgements, capacity accounting, dependency waits, exception routing, and revocation |
| **Revise** | "What changed, what was observed, and which commitment should now change?" | preserved predictions, source revisions, attributed outcomes, reassessed remaining work, and an authorized response |

### Strategic comprehension and reconstruction

recruit at least five suitable decision owners or senior stewards unfamiliar with the implementation for a separate strategic comprehension study. include people responsible for cross-program decisions and affected-party protections.

use Harbor, Meridian, and Open Atlas as explicitly synthetic demonstrations. ask participants to explain objectives, binding capabilities, competing strategies, protected limits, uncertainties, delegated boundaries, and consequential shocks.

a provisional comprehension target is at least four of five completing the core orientation, comparison, authority, and exception tasks without developer explanation. no participant should leave believing synthetic agents are connected or modeled outcomes are independently observed facts.

then reconstruct at least three recent consequential real decisions from authorized evidence, ideally involving multiple interacting programs or resource providers. establish the actual situation, alternatives, authorities, affected parties, constraints, and chosen course before exposing the participant to Zenith's proposed representation.

preserve disagreement and unavailable information. freeze the evidence available at the historical decision point, then examine what later evidence could legitimately have changed.

a reconstruction is useful when it reveals a defensible improvement in understanding, comparison, decision rights, delegation, or review that the accountable owner can identify and evaluate. do not present a hypothetical model's preferred strategy as proof that the actual historical decision was wrong.

these reconstruction and comprehension targets are **future work**, not acceptance results from the present real-project mode.

### Machine-contract and live-agent verification

the existing coordination kernel provides deterministic simulated behavior. before extending it into shared institutional execution, verify the following contracts against actual client interfaces and, where authorized, real external effects:

- source identity, versioning, conflicting evidence, and reproducible frozen decisions.
- scope and policy enforcement, including protected conditions and explicit rights across nested and overlapping scopes.
- atomic shared-capability reservations, preventing double counting and oversubscription.
- dependency ordering, resource shocks, and correctly routed exceptions.
- bounded mandate issuance, acknowledgement, idempotent retries, stale-write rejection, expiry, and revocation.
- preserved consumed resources and in-flight commitments after stop requests.
- reproducible comparison of frozen expectations with independently sourced observations, without assuming causal attribution.

all required deterministic and adversarial cases must pass before a live client acts on consequential resources. record exactly which checks execute in code, which use simulated clients, and which depend on external providers.

a local rule or synthetic receipt does not establish authenticated institutional authority. cross-workspace commitments require durable shared identity, authorization, transactional accounting, action receipts, and defined failure recovery before they can be claimed as enforced.

### Bounded live pilot

a first live pilot requires separate authorization, agreed participant rights, explicit protections, permitted external actions, a responsible review owner, stop and escalation procedures, and an observation window.

run alongside the existing decision process where possible. measure preparation effort, missed conditions, commitment conflicts, exceptions, authorization failures, forecast discrepancies, affected-party consequences, and actual changes of course.

compare outcomes against frozen expectations and defensible baselines. do not assign broad causal benefits from a single pilot or treat a feasible plan as proof of a beneficial intervention.

stop external actions at the agreed enforcement boundary when critical limits are breached; preserve the resulting evidence for review and correction.

## 10. interpretation and stopping conditions

**continue** when actual participants repeatedly complete a consequential review accurately, trace its source, preserve historical reasoning, and gain identifiable value without weakening authority or protection boundaries.

**revise** when users cannot understand the source, the attention queue is dominated by low-value questions, significant conditions are routinely absent from input, historical judgments become misleading, or the review must be reconstructed in another system.

**stop or narrow the evaluation** when permissions cannot be established, the available data cannot support a meaningful judgment, critical errors remain unresolved, or the cost and risk of continued testing outweigh the evidence it can provide.

distinguish failure of an implementation from failure of the underlying strategic hypothesis. weak project-export review may reveal a need for better source contracts, richer contextual models, or a different entry point. it is not, by itself, a verdict on institution-scale coordination. equally, the ambition of the full system cannot excuse an immediate workflow that is inaccurate or not useful.

## 11. historical scope and references

the earlier Alder calculator and journal are archived history, not the current active application. their comprehension tests and model checks remain historical engineering evidence in [Design QA](../design-qa.md).

the initial regional energy–housing–workforce demonstration and the current Harbor, Meridian, and Open Atlas profiles remain synthetic strategic test environments. their agents, effects, and outcomes cannot be counted as field evidence or empirical forecast validation.

this protocol supersedes the 2026.10.04 usefulness-test framing while preserving its central questions about comprehension, source correctness, consequential choice, legitimate delegation, and repeated decision value.

relevant governing documents:

- [product vision](product_vision.md): overarching purpose, philosophy, and coordination primitives.
- [roadmap](roadmap.md): staged sequence from real-source review to strategic authoring, live clients, and federation.
- [implementation status](implementation_status.md): implemented behavior, engineering verification, and current limits.
- [running contract](mvp.md): actual application paths, state transitions, and authority boundaries.
- [project-data contract](project-data.md): accepted formats, mappings, normalization, limits, and refresh semantics.
- [testing guide](testing_guide.md): reproducible engineering verification.
- [real-project acceptance record](design/2026-11-02/real-projects/README.md): the 2026.11.02 automated workflow checks and captures.

**current empirical result: pending.** this document defines what to test, how to measure it, how to protect participants and source information, and how to record findings. only executed, dated, source-backed results can change that status.
