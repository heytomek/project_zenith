import { describe, expect, test } from "bun:test";
import {
  BASELINE,
  PATHWAYS,
  canonical,
  evaluate,
  validateAssumptions,
} from "../../apps/web/lib/commons/model";
import {
  EMPTY_WORKSPACE,
  exportWorkspace,
  importWorkspace,
  workspaceSchema,
  type Workspace,
} from "../../apps/web/lib/commons/workspace";

describe("healthy homes stock and flow", () => {
  test("current practice has a hand-checkable 36 productive hours and 4.5 repairs monthly", () => {
    const run = evaluate(PATHWAYS[0]);
    expect(run.months[1].availableHours).toBe(36);
    expect(run.months[1].completed).toBe(4.5);
    expect(run.incoming).toBe(54);
    expect(run.completed).toBe(54);
    expect(run.remaining).toBe(30);
    expect(run.workHours).toBe(432);
  });
  test("sharing meets the full need without reporting excluded work as served", () => {
    const r = evaluate(PATHWAYS[1]);
    expect(r.completed).toBeCloseTo(84);
    expect(r.remaining).toBe(0);
    expect(r.incoming).toBe(54);
    expect(r.materialUnits).toBeCloseTo(84);
  });
  test("prevention consumes scarce capacity first and changes only future arrivals", () => {
    const r = evaluate(PATHWAYS[2]);
    expect(r.months[1].investmentHours).toBe(48);
    expect(r.months[1].completed).toBeCloseTo(1.8);
    expect(r.months[4].remaining).toBeCloseTo(40.8);
    expect(r.months[4].incoming).toBe(4.5);
    expect(r.months[5].incoming).toBeCloseTo(2.7);
    expect(r.activationMonth).toBe(5);
    expect(r.workHours).toBeCloseTo(748.8);
    expect(r.materialUnits).toBeCloseTo(149.6);
  });
  test("a declared short lead cannot grant benefits before investment is complete", () => {
    const p = {
      ...PATHWAYS[2],
      assumptions: { voluntaryHours: 0, leadMonths: 1, reductionPercent: 80 },
    };
    const r = evaluate(p);
    expect(r.months[1].investmentHours).toBe(52);
    expect(r.months[1].completed).toBe(0);
    expect(r.activationMonth).toBe(5);
    expect(r.months[4].incoming).toBe(4.5);
    expect(r.months[5].incoming).toBeCloseTo(0.9);
  });
  test("no benefit appears beyond the chosen horizon", () => {
    const r = evaluate({
      ...PATHWAYS[2],
      assumptions: { voluntaryHours: 16, leadMonths: 12, reductionPercent: 80 },
    });
    expect(r.activationMonth).toBeNull();
    expect(r.investmentComplete).toBe(true);
    expect(r.recurringAtEnd).toBe(4.5);
  });
  test("stock, hours, material and area totals conserve throughout sensitivity space", () => {
    for (const base of PATHWAYS)
      for (const hours of [0, 16, 80])
        for (const lead of [1, 4, 12])
          for (const reduction of [0, 40, 80])
            for (const stress of [false, true]) {
              const p = {
                ...base,
                assumptions: {
                  voluntaryHours: hours,
                  leadMonths: lead,
                  reductionPercent: reduction,
                },
              };
              const r = evaluate(p, stress);
              for (let i = 1; i < r.months.length; i++) {
                const m = r.months[i],
                  prev = r.months[i - 1];
                expect(m.remaining).toBeGreaterThanOrEqual(0);
                expect(m.completed).toBeGreaterThanOrEqual(0);
                expect(m.remaining).toBeCloseTo(
                  prev.remaining + m.incoming - m.completed,
                  8,
                );
                expect(m.neighborhoods.reduce((a, b) => a + b, 0)).toBeCloseTo(
                  m.remaining,
                  8,
                );
                expect(m.repairHours + m.investmentHours).toBeLessThanOrEqual(
                  m.availableHours + 1e-8,
                );
              }
              expect(r.completed + r.remaining).toBeCloseTo(30 + r.incoming, 8);
              expect(r.investmentHours).toBeLessThanOrEqual(
                BASELINE.preventionHours + 1e-8,
              );
              expect(r.materialUnits).toBeCloseTo(
                r.completed + (r.investmentHours / 192) * 80,
                8,
              );
            }
  });
  test("evaluation is deterministic and cannot change an input or baseline", () => {
    const before = canonical({ PATHWAYS, BASELINE });
    const p = structuredClone(PATHWAYS[2]);
    const r = evaluate(p);
    p.assumptions.reductionPercent = 0;
    expect(r.pathway.assumptions.reductionPercent).toBe(40);
    expect(canonical(evaluate(PATHWAYS[2]))).toBe(
      canonical(evaluate(PATHWAYS[2])),
    );
    expect(canonical({ PATHWAYS, BASELINE })).toBe(before);
  });
  test("invalid assumptions fail explicitly", () => {
    for (const value of [NaN, Infinity, -1, 81])
      expect(() =>
        validateAssumptions({
          ...PATHWAYS[2].assumptions,
          voluntaryHours: value,
        }),
      ).toThrow();
    expect(() =>
      validateAssumptions({ ...PATHWAYS[2].assumptions, leadMonths: 1.5 }),
    ).toThrow();
    expect(() =>
      validateAssumptions({ ...PATHWAYS[2].assumptions, reductionPercent: 81 }),
    ).toThrow();
  });
});
const example = (): Workspace => ({
  ...structuredClone(EMPTY_WORKSPACE),
  decisions: [
    {
      id: "decision-test",
      parentId: null,
      createdAt: "2026-09-12T12:00:00.000Z",
      pathway: structuredClone(PATHWAYS[2]),
      challenges: [],
      action: "Test an opt-in retrofit pilot",
      rationale: "Learn before committing district-wide resources.",
      steward: "Demo facilitator",
      authority: "Not established; resident-led review is required.",
      consent: "Explicit tenant and worker agreement.",
      reviewDate: "2026-10-12",
      success: "Lower recurrence without worse access.",
      reversal: "Stop if any tenant loses repair access.",
    },
  ],
  observations: [
    {
      id: "observation-test",
      decisionId: "decision-test",
      createdAt: "2026-09-12T12:00:00.000Z",
      month: 3,
      remaining: 41,
      note: "Synthetic walkthrough observation.",
    },
  ],
});
describe("portable immutable records", () => {
  test("export and import reproduce a decision and observation exactly", async () => {
    const w = example();
    const file = await exportWorkspace(w);
    expect(await importWorkspace(file)).toEqual(w);
    expect(await exportWorkspace(w)).toBe(file);
  });
  test("tampered outputs and unsupported baselines are rejected", async () => {
    const file = JSON.parse(await exportWorkspace(example()));
    file.results.pathways[0].expected.remaining = 999;
    await expect(importWorkspace(JSON.stringify(file))).rejects.toThrow(
      "checksum",
    );
    file.baseline.offeredHours = 999;
    await expect(importWorkspace(JSON.stringify(file))).rejects.toThrow(
      "baseline",
    );
  });
  test("even a recomputed checksum cannot hide unreproducible output", async () => {
    const file = JSON.parse(await exportWorkspace(example()));
    file.results.pathways[0].expected.remaining = 999;
    const { sha256, ...payload } = file;
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(canonical(payload)),
    );
    file.sha256 = Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await expect(importWorkspace(JSON.stringify(file))).rejects.toThrow(
      "reproduced",
    );
  });
  test("broken references, duplicate IDs and unsupported versions do not enter storage", () => {
    const w = example();
    w.observations[0].decisionId = "absent";
    expect(workspaceSchema.safeParse(w).success).toBe(false);
    w.observations[0].decisionId = "decision-test";
    w.observations[0].id = "decision-test";
    expect(workspaceSchema.safeParse(w).success).toBe(false);
    expect(
      workspaceSchema.safeParse({ ...EMPTY_WORKSPACE, version: 2 }).success,
    ).toBe(false);
    expect(
      workspaceSchema.safeParse({
        ...EMPTY_WORKSPACE,
        branches: [{ ...PATHWAYS[0] }],
      }).success,
    ).toBe(false);
  });
  test("a revision retains the old inputs and observations", async () => {
    const w = example(),
      old = structuredClone(w.decisions[0]);
    w.decisions.push({
      ...structuredClone(old),
      id: "revision-test",
      parentId: old.id,
      pathway: {
        ...structuredClone(old.pathway),
        assumptions: { ...old.pathway.assumptions, reductionPercent: 20 },
      },
    });
    const imported = await importWorkspace(await exportWorkspace(w));
    expect(imported.decisions[0]).toEqual(old);
    expect(evaluate(imported.decisions[1].pathway).remaining).toBeGreaterThan(
      evaluate(old.pathway).remaining,
    );
    expect(imported.observations[0].decisionId).toBe(old.id);
  });
  test("oversized and invalid files do not parse", async () => {
    await expect(importWorkspace("x".repeat(2_000_001))).rejects.toThrow(
      "large",
    );
    await expect(importWorkspace("{}")).rejects.toThrow();
  });
});
