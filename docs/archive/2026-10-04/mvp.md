# Alder workspace: implementation and model contract

The owner-directed [product objective](product_vision.md) is strategic coordination for humans and agents. This document describes the implemented Alder calculator/journal; it does not implement the proposed world model, strategic portfolios or agent mandates. Team is reached through the top avatars; generic duplicate routes have been removed.

Core implemented September 12, 2026; case and utility redesign October 3, 2026. The [product vision](product_vision.md) sets the purpose; this document defines the running demonstration.

## Worked case

Alder is a generated housing cooperative: six named team members, six 20-home buildings across three areas, 30 starting repair units affecting 25 homes, and a six-month repair/retrofit pilot. The populated workspace contains four plans, four linked decisions, seven attributed challenges and ten observations. Eight source notes explain the intake register, time diary, permissions, quote, schedule revision, recurrence dispute, stock reconciliation and inspections.

The March audit conserves stock: `30 + 37 new − 27 closed = 40` open units across 32 homes. The original 30-item cohort has 21 resolved and nine still open; later arrivals are accounted for separately. Preliminary readings and reconciliations are both retained. The active Six-month retrofit assumes 16 extra hours/month, six months of installations and a 20% recurrence effect. The unchanged model predicts 34.2 units at month six and nine at month 12; the 5.8-unit observed gap and unmeasured effect keep expansion paused.

All people, documents, permissions, prices and physical observations are fictional. Each forecast comes from `evaluate()`. Household scope is distinct from the model's expected repair units; a 20-home pilot does not demonstrate a 20% district-wide effect. Calendar dates describe a synthetic case running from September 2026 to March 2027.

## Utility views

- **Case:** audited versus projected repairs, recorded points on the comparison curves, an expandable stock ledger, six buildings, searchable 30-item intake register, upcoming review, working plan and record-derived activity.
- **Compare:** all three model alternatives, saved case plans, expected/stress switch, month inspection, synchronized range/number inputs and exploratory presets. Assumptions link to matching source documents. Opening a source preserves the inspected month, stress case and unfinished branch/challenge text.
- **Decisions:** complete action, rationale, steward, authority, consent, review date, success and stopping conditions. Revision titles use the first sentence; remaining action details stay in the document. A revision defaults to the saved scenario; prior decisions and their observations remain. Unfinished forms survive navigation and require saving/canceling before selecting another version.
- **Evidence:** eight attributed, dated source documents with specific findings, limitations and references. Search, assumption filtering, team-document links and source-to-assumption links work.
- **Team:** six case responsibilities, authored documents and the recorded decision process. Avatars represent fictional members, without online presence or authenticated editing claims.

Minimal translucent material is restricted to navigation and controls, following [Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials). Data and documents use solid surfaces. Fast selection, view and disclosure transitions respect reduced motion, transparency and increased contrast. Familiar actions use icons with accessible names and tooltips. The general vision is kept in project documentation; the stock compass/marketing surface was removed.

The model version, baseline, arithmetic and portable JSON version remain unchanged. Alder's local state uses a separate namespace so the earlier workspace remains intact. New record timestamps advance beyond the latest case timestamp when the synthetic snapshot is ahead of the host clock; new review defaults follow that clock.

## Model version `healthy-homes/1.0.0`

Single implementation: [`model.ts`](../apps/web/lib/commons/model.ts). No solver, random seed, date-dependent calculation, API or database lookup participates in a run. Calendar dates describe records; model time is month 0 through 12.

| Baseline input | Value and meaning |
| --- | --- |
| Scope | 120 fictional homes, 40 per neighborhood |
| Initial expected repair needs | Riverside 12, Parkside 10, Hilltop 8 |
| New expected needs per month | Riverside 2, Parkside 1.5, Hilltop 1 |
| Base work offered | 80 hours per month; willingness not verified |
| Productive share | Current practice 45%; coordination/prevention 65% |
| Repair effort | 8 productive hours per expected repair need |
| Additional voluntary hours | 16/month by default; applies only to pooling pathways |
| Prevention | 192 productive hours plus 80 illustrative material units |
| Lead time | 4 months by default; benefits cannot precede investment completion |
| Prevention effect | 40% fewer new repair needs after activation |
| Repair materials | 1 illustrative repair-equivalent unit per completed need |

Every numeric input is synthetic or assumed. Fractional needs represent expected demand, not partial work on actual households. Multiple needs can recur in one home; the model does not count unique households served.

For each month:

1. Add new needs to each neighborhood's backlog. Apply prevention only after the declared lead time and completion of all 192 investment hours.
2. Calculate productive capacity: `(80 + additional hours) × productive share`. Current practice ignores additional hours.
3. Reserve prevention work: the minimum of productive capacity, remaining investment, and `192 / lead months`. This work competes with repairs. A shortfall delays completion rather than granting an unfunded benefit.
4. Use remaining productive hours for repairs, at 8 hours per need. Current practice divides capacity equally between areas; pooled pathways divide service proportionally to outstanding need. Unused local capacity is not silently transferred in current practice.
5. Subtract completed needs. Accumulate actual productive work and material units; unused hours are not counted as work performed.

The invariant is `ending backlog + completed needs = initial backlog + incoming needs`. Every month also conserves productive capacity and neighborhood totals. The distribution rule is an explicit modeling choice, not a fairness judgment.

### Default results

| Over 12 months | Current practice | Coordinate and share | Invest in prevention |
| --- | ---: | ---: | ---: |
| Needs remaining | 30 | 0 | 0 |
| Repairs completed | 54 | 84 | 69.6 |
| Productive work, hours | 432 | 672 | 748.8 |
| Included investment, hours | 0 | 0 | 192 |
| Recurring needs at month 12 | 4.5 | 4.5 | 2.7 |
| Illustrative material units | 54 | 84 | 149.6 |

Prevention initially increases the backlog: 40.8 needs remain after month 4; its effect starts in month 5. Reducing its assumed effect to 20% leaves 7.2 needs at month 12. The first year uses more work and materials than sharing alone. No pathway is declared the winner.

The pessimistic case applies 25% less productive capacity, 25% more new demand, three additional months of lead time (capped at the 12-month horizon), and half the prevention effect. It is a reproducible sensitivity scenario, not an estimated probability or confidence interval. Default remaining needs are 57, 27.3 and 45.675 respectively.

The model omits costs, inventory constraints, skill constraints, repair urgency, travel, energy, emissions, health outcomes and household-level distribution. Material units are an accounting proxy, not ecological impact. Zero modeled backlog is not evidence of healthy homes or legitimate consent.

## State and file contract

[`workspace.ts`](../apps/web/lib/commons/workspace.ts) validates strict, bounded JSON contracts with Zod. A workspace contains branches, challenges, immutable decision versions and observations. A challenge retains the exact pathway assumptions against which it was raised. A draft copies unresolved challenges and a pathway snapshot. An observation references a particular decision version. Imported IDs and revision/observation references are checked.

Exports contain the exact baseline, model version, workspace, normal and pessimistic runs, and a SHA-256 checksum of canonicalized content. Import rejects unsupported versions, changed baseline facts, invalid values, duplicate identifiers, broken references, oversized files and changed checksums. It also recomputes every exported result and compares it with the file. Checksums detect modification; they do not establish authorship or trust in the assumptions.

The browser is the only persistence layer. A storage failure is reported without claiming a save. A stale write from another tab is rejected rather than overwriting unseen changes. Alder starts from the immutable case fixture and saves changes under `zenith.commons.v1.alder`. Import previews counts, retains the prior workspace at `zenith.commons.v1.alder.previous`, and then replaces the active case workspace. Restore case also preserves a recovery copy. The older `zenith.commons.v1` workspace remains unchanged and can be previewed from Synthetic → Earlier workspace. A corrupted stored workspace is preserved for recovery instead of silently reset.

Export initiates a JSON download and retains a selectable JSON fallback. The bundled case source notes, team and intake register remain fixed reference material; portable exports contain the version-one scenarios, decision records, challenges, observations and reproducible results. This is a snapshot at export time. Unsaved valid pathway changes are included as an additional exported branch. Unsaved decision form fields are not exported; save the draft first.

## Architecture decision

The September direction initially proposed retaining the Next/Python boundary for new modeling. Implementation showed that the smallest coherent demo is a pure deterministic TypeScript model shared by the UI, record reconstruction and export verification. This avoids a second formula implementation, typed API duplication and server-side session state. The retained operational solver is not suitable for long-term needs/capacity modeling without a separate adapter, and is not called.

The web app has no operator API rewrite and no organization, workforce, demand, stock, publication or dispatch routes. Superseded web code is available in Git at `541316ebd2f9ec78ab09e6c0e24d9c0f3d763034`. Existing Python code, tests, migration history and database files remain intact as historical infrastructure. Running that legacy API separately does not make it a production-authorized service.

ESLint 10 remains installed. Its older React rule interfaces are bridged with the [official compatibility utilities](https://eslint.org/blog/2024/05/eslint-compatibility-utilities/); the installed TypeScript parser also handles JS config files because Next's Babel scope interface is incompatible with this ESLint version. Rules are not disabled. [Recharts](https://recharts.github.io/api/ResponsiveContainer/) renders the model chart; an equivalent numeric table is available.

## Validation limits

Automated checks establish arithmetic and contract behavior, not scientific validity. Browser walkthroughs establish that the implemented flow works, not that unfamiliar people understand it. The [usefulness study](usefulness-test.md) remains the next human validation step. No deployment, real public participation, binding approval or five-person usability result is claimed.
