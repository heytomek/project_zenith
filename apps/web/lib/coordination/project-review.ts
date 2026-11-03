import type { ProjectData, ProjectRecord, ProjectResponse, ProjectSnapshot } from "./project-data";

export type ProjectFindingKind = "deadline" | "budget" | "dependency" | "decision";
export type ProjectFinding = {
  id: string;
  fingerprint: string;
  snapshotId: string;
  kind: ProjectFindingKind;
  reviewerId: string;
  project: string;
  title: string;
  question: string;
  summary: string;
  reason: string;
  alternatives: string[];
  owners: string[];
  evidenceIds: string[];
  severity: "urgent" | "review";
  reviewed: boolean;
  response: ProjectResponse | null;
};

export type ProjectCoverageIssue = {
  id: string;
  kind: "owner" | "dates" | "status" | "finance" | "dependency";
  title: string;
  detail: string;
  recordIds: string[];
};

export const projectReviewers = [
  {
    id: "commitments",
    name: "Commitments",
    initials: "CO",
    description: "Checks declared commitments and explicit requests for a decision.",
    rules: [
      "An unfinished commitment has a forecast date later than its due date.",
      "An explicitly open commitment is past its due date at the review date.",
      "An unfinished record explicitly requests a decision.",
    ],
  },
  {
    id: "resources",
    name: "Resources",
    initials: "RE",
    description: "Checks explicit forecasts against approved budgets.",
    rules: ["An unfinished record has a forecast cost above its budget, in an explicitly declared currency. Separate records and currencies are not summed."],
  },
  {
    id: "dependencies",
    name: "Dependencies",
    initials: "DE",
    description: "Checks named dependencies against downstream commitments.",
    rules: [
      "An unfinished dependency has a forecast date later than its downstream commitment's due date.",
      "An unfinished downstream commitment explicitly reports blocked status and has an unfinished named dependency.",
      "Unknown dependency references are source-coverage gaps, not evidence of a delay.",
    ],
  },
] as const;

function validDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)
    throw new Error(`${name} must be a valid ISO date.`);
  return value;
}

const open = (record: ProjectRecord) => record.status !== "done" && record.status !== "cancelled";
const ordered = (records: ProjectRecord[]) => records.slice().sort((a, b) => a.id.localeCompare(b.id));
const plural = (count: number, singular: string, multiple = `${singular}s`) => count === 1 ? singular : multiple;
const amount = new Intl.NumberFormat("en", { maximumFractionDigits: 20 }).format;

function deliverySummary(record: ProjectRecord) {
  return record.forecastDate && record.forecastDate > record.dueDate!
    ? `Committed ${record.dueDate} · forecast ${record.forecastDate}`
    : `Committed ${record.dueDate} · source reports ${record.status}; past due`;
}

function fundingSummary(record: ProjectRecord) {
  return `${record.currency} ${amount(record.forecastCost!)} forecast · ${record.currency} ${amount(record.budget!)} approved`;
}

/** An identity for non-security deduplication; portable-file validation checks the original evidence too. */
function fingerprint(value: unknown): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function common(record: ProjectRecord) {
  return { id: record.id, project: record.project, title: record.title, owner: record.owner, status: record.status };
}

function declaredStatus(snapshot: ProjectSnapshot, record: ProjectRecord) {
  const column = snapshot.mapping.status;
  return Boolean(column && record.cells[column]?.trim());
}

/** Reviews only the latest imported snapshot. These are explicit local rules, not inferred causal forecasts. */
export function reviewProject(data: ProjectData, asOf: string): ProjectFinding[] {
  validDate(asOf, "Review date");
  const snapshot = data.snapshots.at(-1);
  if (!snapshot) return [];
  const byId = new Map(snapshot.records.map(record => [record.id, record]));
  const projects = [...new Set(snapshot.records.map(record => record.project))].sort((a, b) => a.localeCompare(b));
  const findings: ProjectFinding[] = [];
  const append = (project: string, kind: ProjectFindingKind, records: ProjectRecord[], facts: unknown, content: Pick<ProjectFinding, "title" | "question" | "summary" | "reason" | "alternatives" | "severity">) => {
    const id = `project:${project}:${kind}`;
    const value = `rules-v1:${fingerprint({ project, kind, facts })}`;
    const response = data.responses.filter(item => item.findingId === id && item.fingerprint === value).reverse().find(item => {
      const originalIndex = data.snapshots.findIndex(source => source.id === item.snapshotId);
      if (originalIndex < 0) return false;
      // A resolved or changed condition that later recurs needs fresh judgment, even if its old facts return.
      return data.snapshots.slice(originalIndex + 1).every(source => reviewProject({ version: 1, snapshots: [source], responses: [] }, item.reviewDate)
        .some(finding => finding.id === id && finding.fingerprint === value));
    }) ?? null;
    findings.push({
      ...content, id, fingerprint: value, snapshotId: snapshot.id, kind, project,
      reviewerId: kind === "budget" ? "resources" : kind === "dependency" ? "dependencies" : "commitments",
      owners: [...new Set(records.map(record => record.owner).filter(Boolean))].sort(),
      evidenceIds: [...new Set(records.map(record => record.id))].sort(),
      reviewed: Boolean(response), response,
    });
  };
  for (const project of projects) {
    const records = ordered(snapshot.records.filter(record => record.project === project && open(record)));
    const late = records.filter(record => record.dueDate && (
      (record.forecastDate && record.forecastDate > record.dueDate) ||
      (record.dueDate < asOf && declaredStatus(snapshot, record))
    ));
    if (late.length) {
      const facts = late.map(record => ({ ...common(record), dueDate: record.dueDate, forecastDate: record.forecastDate, overdue: record.dueDate! < asOf, declaredStatus: declaredStatus(snapshot, record) }));
      const overdue = late.filter(record => record.dueDate! < asOf);
      append(project, "deadline", late, facts, {
        title: "Reconcile delivery commitments",
        question: late.length === 1 ? `${late[0].title}: ${late[0].forecastDate && late[0].forecastDate > late[0].dueDate! ? "keep" : "verify"} or revise the commitment?` : "Which dates should we defend, change, or verify?",
        summary: late.length === 1 ? `${deliverySummary(late[0])}.` : `${late.length} commitments · ${late[0].title}: ${deliverySummary(late[0])}.`,
        reason: late.map(record => `${record.title}: ${record.forecastDate && record.forecastDate > record.dueDate! ? `forecast ${record.forecastDate} exceeds commitment ${record.dueDate}` : `source still reports ${record.status} after commitment ${record.dueDate}`}.`).join(" "),
        alternatives: ["Confirm completion or the current forecast with the cited owner.", "Revise the commitment with affected participants, or agree a recovery plan within existing authority."],
        severity: overdue.length ? "urgent" : "review",
      });
    }
    const overspent = records.filter(record => record.budget !== null && record.forecastCost !== null && record.currency && record.forecastCost > record.budget);
    if (overspent.length) append(project, "budget", overspent, overspent.map(record => ({ ...common(record), budget: record.budget, forecastCost: record.forecastCost, currency: record.currency })), {
      title: "Resolve a funding gap",
      question: overspent.length === 1 ? `${overspent[0].title}: resolve the funding gap?` : "Should scope, forecast, or approved funding change?",
      summary: overspent.length === 1 ? `${fundingSummary(overspent[0])}.` : `${overspent.length} forecasts exceed approved budgets · ${overspent[0].title}: ${fundingSummary(overspent[0])}.`,
      reason: overspent.map(record => `${record.title}: ${record.forecastCost} ${record.currency} forecast against ${record.budget} ${record.currency} budget.`).join(" "),
      alternatives: ["Validate the forecast and the scope covered by each budget.", "Agree a scope reduction or request a funding decision; no additional spending is authorized by this review."],
      severity: "urgent",
    });
    const links: { downstream: ProjectRecord; upstream: ProjectRecord; late: boolean; blocked: boolean }[] = [];
    for (const downstream of records) for (const dependency of downstream.dependsOn) {
      const upstream = byId.get(dependency);
      if (!upstream || upstream.id === downstream.id || !open(upstream)) continue;
      const late = Boolean(downstream.dueDate && upstream.forecastDate && upstream.forecastDate > downstream.dueDate);
      const blocked = downstream.status === "blocked" && declaredStatus(snapshot, downstream);
      if (late || blocked) links.push({ downstream, upstream, late, blocked });
    }
    if (links.length) {
      links.sort((a, b) => a.downstream.id.localeCompare(b.downstream.id) || a.upstream.id.localeCompare(b.upstream.id));
      const affected = [...new Map(links.flatMap(link => [link.downstream, link.upstream]).map(record => [record.id, record])).values()];
      const dependentCount = new Set(links.map(link => link.downstream.id)).size;
      const first = links[0];
      const dependencySummary = first.upstream.forecastDate && first.downstream.dueDate
        ? `${first.upstream.title}: forecast ${first.upstream.forecastDate} · ${first.downstream.title}: committed ${first.downstream.dueDate}${first.blocked ? " · blocked in source" : ""}`
        : `${first.downstream.title}: blocked in source · dependency ${first.upstream.title} is not recorded as complete`;
      append(project, "dependency", affected, links.map(link => ({ downstream: { ...common(link.downstream), dueDate: link.downstream.dueDate }, upstream: { ...common(link.upstream), forecastDate: link.upstream.forecastDate }, late: link.late, blocked: link.blocked, overdue: Boolean(link.downstream.dueDate && link.downstream.dueDate < asOf) })), {
        title: "Reconcile dependent commitments",
        question: dependentCount === 1 ? `${first.downstream.title}: change the dependency or the commitment?` : "Which dependency or downstream promise needs agreement?",
        summary: links.length === 1 ? `${dependencySummary}.` : `${dependentCount} dependent ${plural(dependentCount, "commitment")} · ${dependencySummary}.`,
        reason: links.map(link => link.late
          ? `${link.upstream.title} forecasts ${link.upstream.forecastDate}; ${link.downstream.title} is committed for ${link.downstream.dueDate}.`
          : `${link.downstream.title} is explicitly marked blocked and names unfinished ${link.upstream.title} as a dependency; the source does not establish that this is the sole cause.`).join(" "),
        alternatives: ["Ask the named owners to confirm dependency readiness and the specific cause of the block.", "Agree a revised sequence, a different dependency, or an explicitly changed downstream commitment."],
        severity: links.some(link => link.blocked || (link.downstream.dueDate && link.downstream.dueDate < asOf)) ? "urgent" : "review",
      });
    }
    const requested = records.filter(record => record.decision.trim());
    if (requested.length) append(project, "decision", requested, requested.map(record => ({ ...common(record), decision: record.decision, dueDate: record.dueDate, overdue: Boolean(record.dueDate && record.dueDate < asOf) })), {
      title: "Answer a requested decision",
      question: requested.length === 1 ? requested[0].decision : "Which requested decisions should be resolved together?",
      summary: requested.length === 1 ? `${requested[0].title}${requested[0].dueDate ? ` · committed ${requested[0].dueDate}` : ""}.` : `${requested.length} explicit requests · ${requested.slice(0, 2).map(record => record.title).join(" · ")}${requested.length > 2 ? ` · +${requested.length - 2} more` : ""}.`,
      reason: requested.map(record => `${record.title}: ${record.decision}`).join(" "),
      alternatives: ["Record the decision and its reasons, or specify what evidence is needed before deciding.", "Confirm the responsible authority with the named owner; imported ownership is not authenticated decision permission."],
      severity: requested.some(record => record.status === "blocked" || (record.dueDate && record.dueDate < asOf)) ? "urgent" : "review",
    });
  }
  return findings.sort((a, b) => Number(a.reviewed) - Number(b.reviewed) || Number(b.severity === "urgent") - Number(a.severity === "urgent") || a.project.localeCompare(b.project) || a.kind.localeCompare(b.kind));
}

/** Coverage stays separate from the human decision queue; absent data is not a fabricated risk. */
export function projectCoverage(snapshot: ProjectSnapshot): ProjectCoverageIssue[] {
  const issues: ProjectCoverageIssue[] = [];
  const add = (kind: ProjectCoverageIssue["kind"], records: ProjectRecord[], title: string, detail: string) => {
    if (records.length) issues.push({ id: `coverage:${kind}`, kind, title, detail, recordIds: records.map(record => record.id) });
  };
  const active = snapshot.records.filter(open);
  add("owner", active.filter(record => !record.owner), "Missing owners", "These source records do not name an accountable owner. No owner has been inferred.");
  add("dates", active.filter(record => !record.dueDate), "Missing commitment dates", "Deadline and dependency-window checks require explicit commitment dates. Undated records have not been treated as on time.");
  add("status", active.filter(record => !declaredStatus(snapshot, record)), "Unstated status", "A blank source status is normalized for display only. It cannot establish that a past-due commitment remains unfinished.");
  add("finance", active.filter(record => (record.budget !== null || record.forecastCost !== null) && (record.budget === null || record.forecastCost === null || !record.currency)), "Incomplete funding comparisons", "A funding review requires both a budget and a forecast in one explicit currency. No totals or currency conversions have been inferred.");
  const ids = new Set(snapshot.records.map(record => record.id));
  add("dependency", active.filter(record => record.dependsOn.some(dependency => dependency === record.id || !ids.has(dependency))), "Unresolved dependency references", "Some referenced IDs are absent or self-referential. Missing work may be outside this snapshot's scope; absence does not establish a delay or completion.");
  return issues;
}

export function recordProjectDecision(data: ProjectData, findingId: string, expectedFingerprint: string, decision: string, options: { asOf: string; createdAt?: string; id?: string }): ProjectData {
  const asOf = validDate(options.asOf, "Review date");
  const text = decision.trim();
  if (!text || text.length > 4000) throw new Error("A decision needs 1–4,000 characters.");
  const finding = reviewProject(data, asOf).find(item => item.id === findingId);
  if (!finding || finding.fingerprint !== expectedFingerprint) throw new Error("The evidence changed. Reopen this decision before recording a response.");
  const createdAt = options.createdAt ?? new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt)
    throw new Error("Decision time must be a valid UTC timestamp.");
  const id = options.id ?? `response-${crypto.randomUUID()}`;
  if (!id.trim() || id.length > 160 || data.responses.some(response => response.id === id)) throw new Error("Decision identity must be unique.");
  return { ...data, responses: [...data.responses, { id, findingId, fingerprint: finding.fingerprint, snapshotId: finding.snapshotId, decision: text, reviewDate: asOf, createdAt }] };
}
