# UI rebuild specification

September 12, 2026 · target experience for the proposed [product direction](product_vision.md). This replaces the earlier operator-console plan. The selected Fieldwork direction and core flow are now implemented. See [the MVP contract](mvp.md) and [design QA](../design-qa.md) for verified scope.

## Primary job

Help a person understand a shared objective, compare ways to achieve it, inspect a consequential assumption, and record a revisable next step.

## Information architecture

There are three working views inside a project: **Overview · Pathways · Record**. Evidence is available in context from every claim, number, and assumption. A small project index is useful once a second project exists; the initial demo opens the healthy-homes project directly.

The public unit of navigation is a project. Organization IDs, workers, catalogs, stock CRUD, dispatch, and API diagnostics do not belong in the primary navigation.

## 1. Overview

First viewport:

- Project title: **Healthy homes for everyone**.
- Plain question: **How can this district meet every household's repair needs while reducing recurring work?**
- Explicit label: **Demonstration · synthetic data**.
- Scope line: **120 homes · 3 neighborhoods · 12-month comparison**.
- A compact baseline: **30 initial needs**, the source status, date/version, and named unknowns. These are fixture inputs, not proof of real conditions.
- A short “What success means” paragraph covering access, workload, distribution, ecological burden, and agency.
- One primary action: **Compare pathways**.

Below: who is affected, the project's steward and decision process, what the model includes/excludes, and what is still disputed. A future aspiration should be legible without reading a manifesto.

## 2. Pathways

This is the product's main working surface.

Use a comparison table with three columns: **Current practice**, **Coordinate and share**, **Invest in prevention**. These columns represent genuinely parallel alternatives and justify a comparative layout.

Stable rows:

- what changes and when;
- needs addressed / needs remaining, by neighborhood;
- required work now and recurring work later;
- materials and equipment use;
- upfront investment and lead time;
- known adverse effects and missing evidence;
- consent/commitment requirements;
- reversibility and performance under a pessimistic assumption.

Show monthly evolution only where it helps explain delayed benefits or an upfront burden. Provide the same values as a table. Avoid single-score rankings and preselected “best” winners.

Selecting a difference opens an adjacent detail panel with the equation or causal claim, input values, units, evidence, and uncertainty. A user can change a permitted assumption, create a named branch, and see a delta against the original. Original assumptions remain visible.

Primary action: **Record a next step**. Supporting actions: **Change assumption**, **Inspect evidence**, **Challenge this assumption**, **Export comparison**. Do not ask the user to run a generic solver before they know what decision is being compared.

Use a narrow, deliberately explained set of inputs. Broadly meaningful changes include volunteered capability hours, intervention lead time, and recurring-demand reduction. Changes to values or protections require explicit revision of the project's normative assumptions, not a hidden optimization slider.

## 3. Record

A concise, printable decision document:

- the next experiment or action;
- pathway and baseline version used;
- why it was chosen and which alternatives were considered;
- predicted consequences and confidence limits;
- unresolved challenges and dissent;
- who may authorize it, whose agreement is needed, and who maintains the record;
- review date, observable success/failure conditions, and reversal conditions;
- later observations linked to the original predictions.

Demo action: **Save draft decision**. Never label this “community approved” because a visitor clicked a button. A saved draft can be reopened, revised, and exported; old versions remain inspectable.

## Visual direction

Use the owner's calm technical density: a warm neutral canvas, dark readable text, thin keylines, a restrained sage accent, and a small consistent radius. Typography, alignment, and spacing establish hierarchy. Use the system font stack with regular body weight, tabular numerals for comparisons, and a moderate title size.

The composition is one coherent working surface: compact project header, a short local navigation row, main content, and optional evidence inspector. Remove the decorative grid, oversized “Review exceptions” headline, repeated organization metadata, duplicate navigation, icon boxes, nested cards, and repeated status pills visible in the audit.

Give the project generous outer space while keeping the comparison rows dense and readable. Keep key caveats next to the claims they qualify. Use color for meaningful differences and status, always accompanied by text or symbols.

Before implementation, explore visual targets using this real content and the captured existing interface as context. Select one coherent design; do not mix multiple visual systems.

## Interaction and accessibility requirements

- Use buttons and links for all actionable rows; current click-only table rows must be replaced.
- Provide visible keyboard focus, a skip link, programmatic current navigation, properly associated labels, and descriptive names for icon controls.
- Announce errors and completed calculations; keep focus near the action and link errors to affected inputs.
- Prefer a selection list over modifier-key-dependent multi-select for any essential multi-item interaction.
- All core actions must work at 390px and 200% zoom. On narrow screens, show one pathway against the baseline with a persistent alternative selector and aligned metric labels.
- Use a compact mobile header; avoid horizontally scrolling the whole navigation. Comparison tables may scroll within labeled regions when a stacked equivalent is available.
- Keep a persistent indication of changed assumptions and unsaved edits. Reset should explain what returns to the baseline.
- Treat loading, zero results, unknown evidence, solver failure, and a modeled constraint violation as distinct states.
- Honor reduced motion. Use short transitions only for selection, computation feedback, and inspector continuity.

## Design acceptance walkthrough

1. Open the project; explain the desired condition and synthetic-data limitation.
2. Compare the three pathways; identify an upfront burden and a delayed benefit.
3. Inspect an assumption; distinguish evidence from a modeling choice.
4. Change it; explain which result changes and whether the pathway remains feasible.
5. Attach a specific challenge and save a draft decision with a review condition.
6. Export, reopen, and reproduce the result; repeat the core flow by keyboard and on a narrow viewport.

A visual mock alone does not satisfy this walkthrough. Working controls and a traceable model are part of the design.
