import { describe, expect, test } from "bun:test";
import type { ProjectData, ProjectRecord, ProjectSnapshot } from "../../apps/web/lib/coordination/project-data";
import { projectCoverage, projectReviewers, recordProjectDecision, reviewProject } from "../../apps/web/lib/coordination/project-review";

const asOf = "2026-11-02";
const record = (id: string, values: Partial<ProjectRecord> = {}): ProjectRecord => ({
  id, title: `Commitment ${id}`, project: "Customer migration", owner: "Maya Chen", status: "active",
  dueDate: "2026-11-20", forecastDate: null, budget: null, forecastCost: null, currency: null,
  dependsOn: [], decision: "", updatedAt: null, sourceUrl: null, sourceRow: 1,
  cells: { id, title: `Commitment ${id}`, project: "Customer migration", status: "active" }, ...values,
});
const snapshot = (records: ProjectRecord[], values: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  id: "source-1", name: "Migration portfolio.csv", asOf, importedAt: "2026-11-02T12:00:00.000Z",
  columns: ["id", "title", "project", "status"], mapping: { id: "id", title: "title", project: "project", status: "status" }, records, ...values,
});
const data = (records: ProjectRecord[]): ProjectData => ({ version: 1, snapshots: [snapshot(records)], responses: [] });
const refresh = (value: ProjectData, records: ProjectRecord[]) => ({ ...value, snapshots: [...value.snapshots, snapshot(records, { id: `source-${value.snapshots.length + 1}` })] });
const decide = (value: ProjectData, kind = "deadline") => {
  const finding = reviewProject(value, asOf).find(item => item.kind === kind)!;
  return recordProjectDecision(value, finding.id, finding.fingerprint, "Keep the external date; the delivery owner will verify the revised sequence.", { asOf, id: `response-${value.responses.length + 1}`, createdAt: "2026-11-02T12:05:00.000Z" });
};

describe("real-project review agents", () => {
  test("groups consequential conditions by project and kind, citing every affected source record", () => {
    const value = data([
      record("api", { forecastDate: "2026-11-25" }),
      record("billing", { forecastDate: "2026-11-28", owner: "Inez Rao", sourceRow: 2 }),
      record("archive", { project: "Archive transfer", dueDate: "2026-10-30", sourceRow: 3 }),
    ]);
    const before = structuredClone(value);
    const findings = reviewProject(value, asOf);
    expect(findings).toHaveLength(2);
    const migration = findings.find(item => item.project === "Customer migration")!;
    expect(migration.evidenceIds).toEqual(["api", "billing"]);
    expect(migration.owners).toEqual(["Inez Rao", "Maya Chen"]);
    expect(migration.summary).toContain("2 commitments");
    expect(migration.reason).toContain("2026-11-25");
    expect(migration.severity).toBe("review");
    expect(findings[0].project).toBe("Archive transfer");
    expect(findings[0].severity).toBe("urgent");
    expect(migration.snapshotId).toBe("source-1");
    expect(value).toEqual(before);
    expect(reviewProject(value, asOf)).toEqual(findings);
  });

  test("a past due source is a request to verify or revise, never an invented observation", () => {
    const finding = reviewProject(data([record("old", { dueDate: "2026-10-30" })]), asOf)[0];
    expect(finding.reason).toContain("source still reports active");
    expect(finding.question).toContain("verify");
    expect(finding.summary).toBe("Committed 2026-10-30 · source reports active; past due.");
    expect(finding.alternatives.join(" ")).toContain("Confirm completion");
    expect(reviewProject(data([record("today", { dueDate: asOf })]), asOf)).toEqual([]);
  });

  test("blank or unmapped status cannot establish overdue incompletion", () => {
    const value = data([record("unknown", { status: "planned", dueDate: "2026-10-01", cells: { title: "Unknown status", project: "Migration", status: "" } })]);
    expect(reviewProject(value, asOf)).toEqual([]);
    expect(projectCoverage(value.snapshots[0]).map(issue => issue.kind)).toContain("status");
    value.snapshots[0].mapping = { title: "title", project: "project" };
    expect(reviewProject(value, asOf)).toEqual([]);
    value.snapshots[0].records[0].forecastDate = "2026-10-04";
    expect(reviewProject(value, asOf)[0].reason).toContain("forecast 2026-10-04");
  });

  test("completed and cancelled commitments cannot create a current risk or stale decision request", () => {
    const value = data(["done", "cancelled"].map((status, index) => record(`old-${index}`, {
      status: status as ProjectRecord["status"], dueDate: "2020-01-01", forecastDate: "2030-01-01", budget: 10, forecastCost: 100, currency: "USD", decision: "Old unresolved question", dependsOn: ["missing"],
    })));
    expect(reviewProject(value, asOf)).toEqual([]);
    expect(projectCoverage(value.snapshots[0])).toEqual([]);
  });

  test("funding review requires paired explicit amounts and never sums unlike or overlapping budgets", () => {
    const value = data([
      record("usd", { budget: 100000, forecastCost: 125000, currency: "USD" }),
      record("eur", { budget: 80000, forecastCost: 95000, currency: "EUR" }),
      record("equal", { budget: 5, forecastCost: 5, currency: "USD" }),
      record("no-unit", { budget: 1, forecastCost: 2 }),
      record("no-budget", { forecastCost: 500, currency: "USD" }),
    ]);
    const findings = reviewProject(value, asOf);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("budget");
    expect(findings[0].evidenceIds).toEqual(["eur", "usd"]);
    expect(findings[0].reason).toContain("125000 USD");
    expect(findings[0].reason).toContain("95000 EUR");
    expect(findings[0].reason).not.toContain("220000");
    expect(projectCoverage(value.snapshots[0]).find(issue => issue.kind === "finance")!.recordIds).toEqual(["no-unit", "no-budget"]);
  });

  test("single findings carry the actual commitment and its declared dates or funding amounts", () => {
    const value = data([
      record("migration", { title: "Move enterprise billing to the new processor", forecastDate: "2026-12-01", budget: 150000.25, forecastCost: 184500.75, currency: "USD" }),
    ]);
    const findings = reviewProject(value, asOf);
    expect(findings.find(item => item.kind === "deadline")!.question).toBe("Move enterprise billing to the new processor: keep or revise the commitment?");
    expect(findings.find(item => item.kind === "deadline")!.summary).toBe("Committed 2026-11-20 · forecast 2026-12-01.");
    expect(findings.find(item => item.kind === "budget")!.question).toBe("Move enterprise billing to the new processor: resolve the funding gap?");
    expect(findings.find(item => item.kind === "budget")!.summary).toBe("USD 184,500.75 forecast · USD 150,000.25 approved.");
    expect(findings.every(item => item.evidenceIds.length === 1)).toBe(true);
  });

  test("a cross-project dependency cites both sides but does not invent a causal model", () => {
    const value = data([
      record("contract", { title: "Sign the processor contract", project: "Procurement", forecastDate: "2026-12-01", owner: "Owen Shah" }),
      record("launch", { title: "Launch regional payments", dueDate: "2026-11-25", dependsOn: ["contract"] }),
    ]);
    const finding = reviewProject(value, asOf).find(item => item.kind === "dependency")!;
    expect(finding.project).toBe("Customer migration");
    expect(finding.evidenceIds).toEqual(["contract", "launch"]);
    expect(finding.owners).toEqual(["Maya Chen", "Owen Shah"]);
    expect(finding.reason).toContain("Sign the processor contract forecasts 2026-12-01");
    expect(finding.reason).toContain("committed for 2026-11-25");
    expect(finding.question).toBe("Launch regional payments: change the dependency or the commitment?");
    expect(finding.summary).toBe("Sign the processor contract: forecast 2026-12-01 · Launch regional payments: committed 2026-11-25.");
    expect(finding.severity).toBe("review");
    value.snapshots[0].records[0].status = "done";
    expect(reviewProject(value, asOf).some(item => item.kind === "dependency")).toBe(false);
  });

  test("explicitly blocked status supports an investigation without inventing the sole cause", () => {
    const value = data([
      record("review"),
      record("launch", { status: "blocked", cells: { status: "blocked" }, dependsOn: ["review"] }),
    ]);
    const finding = reviewProject(value, asOf)[0];
    expect(finding.kind).toBe("dependency");
    expect(finding.severity).toBe("urgent");
    expect(finding.reason).toContain("does not establish that this is the sole cause");
    value.snapshots[0].records[1].status = "active";
    value.snapshots[0].records[1].cells.status = "active";
    expect(reviewProject(value, asOf)).toEqual([]);
  });

  test("unknown references and missing coverage remain separate from strategic attention", () => {
    const value = data([record("unknown", { owner: "", dueDate: null, dependsOn: ["external-institution"] })]);
    expect(reviewProject(value, asOf)).toEqual([]);
    const coverage = projectCoverage(value.snapshots[0]);
    expect(coverage.map(issue => issue.kind)).toEqual(["owner", "dates", "dependency"]);
    expect(coverage.find(issue => issue.kind === "dependency")!.detail).toContain("absence does not establish a delay");
  });

  test("explicit requests are preserved verbatim and grouped without fabricating a preferred answer", () => {
    const question = "Should we retain the regional launch or accept the supplier's revised contract?";
    const value = data([record("launch", { decision: question }), record("scope", { decision: "Which region can leave the initial scope?" })]);
    const finding = reviewProject(value, asOf)[0];
    expect(finding.kind).toBe("decision");
    expect(finding.reason).toContain(question);
    expect(finding.evidenceIds).toEqual(["launch", "scope"]);
    expect(finding.alternatives.join(" ")).toContain("authority");
    value.snapshots[0].records.pop();
    expect(reviewProject(value, asOf)[0].question).toBe(question);
  });

  test("a self-reference is a source-quality problem, not evidence of a separate dependency conflict", () => {
    const value = data([record("self", { forecastDate: "2026-12-01", dependsOn: ["self"] })]);
    expect(reviewProject(value, asOf).map(item => item.kind)).toEqual(["deadline"]);
    expect(projectCoverage(value.snapshots[0]).find(issue => issue.kind === "dependency")!.recordIds).toEqual(["self"]);
  });

  test("a response preserves source data and the live condition while marking exact evidence reviewed", () => {
    const value = data([record("late", { forecastDate: "2026-12-01" })]);
    const before = structuredClone(value);
    const updated = decide(value);
    expect(value).toEqual(before);
    expect(updated.snapshots).toEqual(value.snapshots);
    expect(updated.responses[0]).toMatchObject({ snapshotId: "source-1", reviewDate: asOf, decision: "Keep the external date; the delivery owner will verify the revised sequence." });
    const finding = reviewProject(updated, asOf)[0];
    expect(finding.reviewed).toBe(true);
    expect(finding.reason).toContain("forecast 2026-12-01");
    expect(finding.response).toEqual(updated.responses[0]);
  });

  test("unchanged reimports, row positions and freshness metadata do not reopen the same decision", () => {
    const value = decide(data([record("late", { forecastDate: "2026-12-01" }), record("unrelated")]));
    const next = refresh(value, [record("unrelated", { sourceRow: 1 }), record("late", { forecastDate: "2026-12-01", sourceRow: 9, updatedAt: "2026-11-02", sourceUrl: "https://example.org/updated-report", cells: { status: "active", notes: "Freshly exported" } })]);
    const current = reviewProject(next, "2026-11-03")[0];
    expect(current.snapshotId).toBe("source-2");
    expect(current.reviewed).toBe(true);
    expect(current.fingerprint).toBe(value.responses[0].fingerprint);
  });

  test("changed relevant facts or crossing the commitment date reopens attention", () => {
    const value = decide(data([record("late", { forecastDate: "2026-12-01" })]));
    const changed = refresh(value, [record("late", { forecastDate: "2026-12-02" })]);
    expect(reviewProject(changed, asOf)[0].reviewed).toBe(false);
    expect(reviewProject(changed, asOf)[0].fingerprint).not.toBe(value.responses[0].fingerprint);
    expect(reviewProject(value, "2026-11-21")[0].reviewed).toBe(false);
    const resolved = refresh(value, [record("late", { forecastDate: "2026-11-19" })]);
    expect(reviewProject(resolved, asOf)).toEqual([]);
    expect(resolved.responses).toEqual(value.responses);
  });

  test("dependency evidence changes reopen the downstream decision even when its own row is unchanged", () => {
    const records = [record("upstream", { project: "Supplier", forecastDate: "2026-12-01" }), record("launch", { dependsOn: ["upstream"] })];
    const value = decide(data(records), "dependency");
    const next = refresh(value, [{ ...records[0], forecastDate: "2026-12-03" }, records[1]]);
    const finding = reviewProject(next, asOf).find(item => item.kind === "dependency")!;
    expect(finding.reviewed).toBe(false);
    expect(finding.response).toBeNull();
  });

  test("a resolved or changed condition that recurs cannot inherit an earlier response", () => {
    const records = [record("late", { forecastDate: "2026-12-01" })];
    const value = decide(data(records));
    const resolved = refresh(value, [record("late", { forecastDate: "2026-11-19" })]);
    const recurred = refresh(resolved, records);
    expect(reviewProject(recurred, asOf)[0].reviewed).toBe(false);
    expect(reviewProject(recurred, asOf)[0].fingerprint).toBe(value.responses[0].fingerprint);
    expect(reviewProject(decide(recurred), asOf)[0].reviewed).toBe(true);
    const changed = refresh(value, [record("late", { forecastDate: "2026-12-03" })]);
    expect(reviewProject(refresh(changed, records), asOf)[0].reviewed).toBe(false);
    const omitted = refresh(value, [record("unrelated")]);
    expect(reviewProject(refresh(omitted, records), asOf)[0].reviewed).toBe(false);
  });

  test("stale or invalid commands cannot record a response against missing, changed or resolved evidence", () => {
    const value = data([record("late", { forecastDate: "2026-12-01" })]);
    const finding = reviewProject(value, asOf)[0];
    expect(() => recordProjectDecision(value, finding.id, "old-fingerprint", "Proceed", { asOf })).toThrow("evidence changed");
    expect(() => recordProjectDecision(value, "missing", finding.fingerprint, "Proceed", { asOf })).toThrow("evidence changed");
    expect(() => recordProjectDecision(value, finding.id, finding.fingerprint, " ", { asOf })).toThrow("decision needs");
    expect(() => recordProjectDecision(value, finding.id, finding.fingerprint, "x".repeat(4001), { asOf })).toThrow("decision needs");
    expect(() => recordProjectDecision(value, finding.id, finding.fingerprint, "Proceed", { asOf: "2026-02-30" })).toThrow("valid ISO date");
    expect(() => recordProjectDecision(value, finding.id, finding.fingerprint, "Proceed", { asOf, createdAt: "2026-02-30T00:00:00.000Z" })).toThrow("valid UTC");
    const updated = decide(value);
    expect(() => recordProjectDecision(updated, finding.id, finding.fingerprint, "Proceed", { asOf, id: "response-1" })).toThrow("unique");
    const resolved = refresh(value, [record("late", { status: "done" })]);
    expect(() => recordProjectDecision(resolved, finding.id, finding.fingerprint, "Proceed", { asOf })).toThrow("evidence changed");
  });

  test("agent rules and review results are explicit, deterministic and valid on an empty source", () => {
    expect(projectReviewers.map(agent => agent.id)).toEqual(["commitments", "resources", "dependencies"]);
    expect(projectReviewers.every(agent => agent.rules.length > 0)).toBe(true);
    expect(reviewProject({ version: 1, snapshots: [], responses: [] }, asOf)).toEqual([]);
    expect(() => reviewProject(data([]), "2026-11-31")).toThrow("valid ISO date");
    const value = data([record("東京", { project: "地域の調整", forecastDate: "2026-12-01" })]);
    expect(reviewProject(value, asOf)[0].id).toBe("project:地域の調整:deadline");
  });
});
