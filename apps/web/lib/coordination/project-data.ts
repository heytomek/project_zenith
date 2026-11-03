export const PROJECT_FIELDS = [
  "id", "title", "project", "owner", "status", "due_date", "forecast_date",
  "budget", "forecast_cost", "currency", "depends_on", "decision", "updated_at", "source_url",
] as const;
export type ProjectField = (typeof PROJECT_FIELDS)[number];
export type ProjectMapping = Partial<Record<ProjectField, string>>;
export type ParsedProjectInput = { columns: string[]; rows: Record<string, string>[]; format: "csv" | "json" };
export type ProjectRecord = {
  id: string; title: string; project: string; owner: string;
  status: "planned" | "active" | "blocked" | "done" | "cancelled";
  dueDate: string | null; forecastDate: string | null;
  budget: number | null; forecastCost: number | null; currency: string | null;
  dependsOn: string[]; decision: string; updatedAt: string | null; sourceUrl: string | null;
  /** One-based data record; the CSV header is excluded. */
  sourceRow: number; cells: Record<string, string>;
};
export type ProjectSnapshot = {
  id: string; name: string; asOf: string; importedAt: string;
  records: ProjectRecord[]; columns: string[]; mapping: ProjectMapping;
};
export type ProjectResponse = {
  id: string; findingId: string; fingerprint: string; snapshotId: string;
  decision: string; reviewDate: string; createdAt: string;
};
export type ProjectData = { version: 1; snapshots: ProjectSnapshot[]; responses: ProjectResponse[] };

const MAX_BYTES = 2_000_000;
const MAX_ROWS = 500;
const MAX_COLUMNS = 64;
const MAX_CELL = 4000;
const statuses: Record<string, ProjectRecord["status"]> = {
  planned: "planned", todo: "planned", "to do": "planned", backlog: "planned", pending: "planned", "not started": "planned",
  active: "active", "in progress": "active", doing: "active", started: "active", ongoing: "active",
  blocked: "blocked", "on hold": "blocked",
  done: "done", complete: "done", completed: "done", closed: "done", shipped: "done",
  cancelled: "cancelled", canceled: "cancelled", dropped: "cancelled",
};
const aliases: Record<ProjectField, string[]> = {
  id: ["id", "record id", "task id", "issue key", "key", "reference"],
  title: ["title", "summary", "name", "task name", "milestone", "commitment"],
  project: ["project", "project name", "initiative", "programme", "program", "workstream"],
  owner: ["owner", "assignee", "accountable", "responsible", "lead"],
  status: ["status", "state"],
  due_date: ["due date", "due", "due on", "deadline", "committed date", "target date"],
  forecast_date: ["forecast date", "forecast finish", "forecast completion", "expected date", "estimated completion"],
  budget: ["budget", "approved budget", "budget amount", "baseline budget"],
  forecast_cost: ["forecast cost", "forecast spend", "estimate at completion", "eac", "expected cost"],
  currency: ["currency", "currency code"],
  depends_on: ["depends on", "dependencies", "dependency", "predecessors", "predecessor", "blocked by"],
  decision: ["decision", "decision needed", "decision request", "decision required", "ask"],
  updated_at: ["updated at", "updated", "last updated", "modified", "update date"],
  source_url: ["source url", "url", "link", "issue url"],
};

function ensure(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function object(value: unknown, name: string): Record<string, unknown> {
  ensure(value !== null && typeof value === "object" && !Array.isArray(value), `${name} must be an object.`);
  return value as Record<string, unknown>;
}
function shape(value: unknown, name: string, keys: readonly string[]): Record<string, unknown> {
  const result = object(value, name);
  ensure(Object.keys(result).length === keys.length && keys.every(key => Object.hasOwn(result, key)), `${name} has unsupported or missing fields.`);
  return result;
}
function text(value: unknown, name: string, max = MAX_CELL, blank = false): string {
  ensure(typeof value === "string" && value.length <= max && (blank || value.trim().length > 0), `${name} must be ${blank ? "text" : "non-empty text"}, at most ${max} characters.`);
  return value;
}
function date(value: unknown, name: string): string {
  ensure(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value, `${name} must be a valid YYYY-MM-DD date.`);
  return value;
}
function instant(value: unknown, name: string): string {
  const result = text(value, name, 40);
  ensure(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result) && Number.isFinite(Date.parse(result)) && new Date(result).toISOString() === result, `${name} must be a valid UTC timestamp.`);
  return result;
}
function updatedDate(value: string, name: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return date(value, name);
  const parts = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  ensure(parts && Number(parts[2]) < 24 && Number(parts[3]) < 60 && Number(parts[4]) < 60 && (!parts[6] || Number(parts[6]) < 24) && (!parts[7] || Number(parts[7]) < 60), `${name} must be a YYYY-MM-DD date or RFC3339 timestamp.`);
  date(parts[1], name);
  ensure(Number.isFinite(Date.parse(value)), `${name} is not a valid timestamp.`);
  return new Date(value).toISOString().slice(0, 10);
}
function columns(input: unknown): string[] {
  ensure(Array.isArray(input) && input.length > 0 && input.length <= MAX_COLUMNS, `Use 1–${MAX_COLUMNS} columns.`);
  const result = input.map((value, i) => text(value, `Column ${i + 1}`, 160).trim());
  ensure(new Set(result.map(value => value.toLowerCase())).size === result.length, "Column names must be unique, including case and surrounding spaces.");
  return result;
}
function rawCells(input: unknown, headings: string[], name: string): Record<string, string> {
  const values = shape(input, name, headings);
  return Object.fromEntries(headings.map(key => [key, text(values[key], `${name}.${key}`, MAX_CELL, true)]));
}
function mapping(input: unknown, headings: string[]): ProjectMapping {
  const values = object(input, "Column mapping");
  ensure(Object.keys(values).every(key => PROJECT_FIELDS.includes(key as ProjectField)), "Column mapping contains an unsupported field.");
  const result: ProjectMapping = {};
  for (const field of PROJECT_FIELDS) {
    if (!Object.hasOwn(values, field) || values[field] === "") continue;
    const heading = text(values[field], `Mapping ${field}`, 160);
    ensure(headings.includes(heading), `Mapping ${field} refers to an unknown column.`);
    result[field] = heading;
  }
  ensure(result.title && result.project, "Map both Title and Project before importing.");
  return result;
}

/** RFC4180-style records, with explicit rejection of malformed quotes and row widths. */
function csv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const finishField = () => { ensure(field.length <= MAX_CELL, `Cells must be at most ${MAX_CELL} characters.`); row.push(field); field = ""; closed = false; ensure(row.length <= MAX_COLUMNS, `Use at most ${MAX_COLUMNS} columns.`); };
  const finishRow = () => { finishField(); if (row.some(value => value.trim())) rows.push(row); row = []; ensure(rows.length <= MAX_ROWS + 1, `Use at most ${MAX_ROWS} data rows.`); };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += char;
    } else if (char === ",") finishField();
    else if (char === "\r" || char === "\n") { if (char === "\r" && text[i + 1] === "\n") i++; finishRow(); }
    else if (char === '"') { ensure(!field && !closed, "A CSV quote must begin a field; escape inner quotes as two quotes."); quoted = true; }
    else if (closed) ensure(char === " " || char === "\t", "Unexpected text after a closing CSV quote.");
    else field += char;
    ensure(field.length <= MAX_CELL, `Cells must be at most ${MAX_CELL} characters.`);
  }
  ensure(!quoted, "The CSV ends inside a quoted field.");
  if (field || row.length || closed) finishRow();
  return rows;
}
function jsonCell(value: unknown, name: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return text(value, name, MAX_CELL, true);
  if (typeof value === "number") {
    ensure(Number.isFinite(value), `${name} is not a finite number.`);
    ensure(!Number.isInteger(value) || Number.isSafeInteger(value), `${name} is outside the safe integer range. Quote large IDs or amounts as strings.`);
  }
  const encoded = JSON.stringify(value);
  return text(encoded, name, MAX_CELL, true);
}
export function parseProjectInput(input: string): ParsedProjectInput {
  ensure(typeof input === "string" && new TextEncoder().encode(input).length <= MAX_BYTES, "Project files must be at most 2 MB.");
  const source = input.replace(/^\uFEFF/, "");
  ensure(source.trim(), "Choose a CSV or JSON file containing project records.");
  if (/^[\s]*[\[{]/.test(source)) {
    let parsed: unknown;
    try { parsed = JSON.parse(source); } catch { throw new Error("The JSON could not be read. Use an array of records or an object with a records array."); }
    if (!Array.isArray(parsed)) parsed = shape(parsed, "Project JSON", ["records"]).records;
    ensure(Array.isArray(parsed) && parsed.length > 0 && parsed.length <= MAX_ROWS, `Use 1–${MAX_ROWS} project records.`);
    const records = parsed.map((row, i) => object(row, `Record ${i + 1}`));
    const headings = columns([...new Set(records.flatMap(row => Object.keys(row)))]);
    // Keep original JSON key spelling rather than trimming a key then losing its value.
    ensure(records.every(row => Object.keys(row).every(key => headings.includes(key))), "JSON column names cannot have surrounding spaces.");
    const rows = records.map((row, i) => Object.fromEntries(headings.map(key => [key, jsonCell(Object.hasOwn(row, key) ? row[key] : null, `Record ${i + 1}.${key}`)])));
    return { columns: headings, rows, format: "json" };
  }
  const records = csv(source);
  ensure(records.length > 1, "The CSV needs a header and at least one data row.");
  const headings = columns(records[0]);
  const rows = records.slice(1).map((row, i) => { ensure(row.length === headings.length, `Data row ${i + 1} has ${row.length} cells; the header has ${headings.length}.`); return Object.fromEntries(headings.map((heading, j) => [heading, row[j]])); });
  return { columns: headings, rows, format: "csv" };
}
export function suggestProjectMapping(headings: string[]): ProjectMapping {
  const normalized = (value: string) => value.toLowerCase().replace(/[\s_.-]+/g, "");
  const result: ProjectMapping = {};
  for (const field of PROJECT_FIELDS) {
    const heading = aliases[field].map(alias => headings.find(item => normalized(item) === normalized(alias))).find(Boolean);
    if (heading) result[field] = heading;
  }
  return result;
}
function stableId(project: string, title: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(`${project}\u0000${title}`)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 0x100000001b3n); }
  return `row-${hash.toString(16).padStart(16, "0")}`;
}
function amount(value: string, name: string): number | null {
  if (!value) return null;
  ensure(/^(?:\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(value), `${name} must be a nonnegative number, without currency symbols.`);
  const result = Number(value.replaceAll(",", ""));
  ensure(Number.isFinite(result) && result >= 0 && result <= Number.MAX_SAFE_INTEGER, `${name} must be finite, nonnegative and at most ${Number.MAX_SAFE_INTEGER}.`);
  return result;
}
function dependencies(value: string, name: string): string[] {
  if (!value) return [];
  let result: string[];
  if (value.startsWith("[")) {
    let parsed: unknown;
    try { parsed = JSON.parse(value); } catch { throw new Error(`${name} must be IDs separated by semicolons, commas or a JSON array.`); }
    ensure(Array.isArray(parsed) && parsed.every(id => typeof id === "string" || (typeof id === "number" && Number.isSafeInteger(id))), `${name} must be an array of string IDs or safe integer IDs. Quote large identifiers.`);
    result = parsed.map(id => String(id).trim());
  } else result = value.split(/[;,\n]/).map(id => id.trim());
  ensure(result.length <= MAX_ROWS && result.every(id => id.length > 0 && id.length <= 200), `${name} contains an empty or oversized record ID.`);
  ensure(new Set(result).size === result.length, `${name} repeats a record ID.`);
  return result;
}
function normalize(cells: Record<string, string>, selected: ProjectMapping, index: number): ProjectRecord {
  const value = (field: ProjectField) => selected[field] ? cells[selected[field]!].trim() : "";
  const row = `Data row ${index + 1}`;
  const title = text(value("title"), `${row} Title`, 300);
  const project = text(value("project"), `${row} Project`, 160);
  const id = value("id") ? text(value("id"), `${row} ID`, 200) : stableId(project, title);
  const rawStatus = value("status").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  ensure(!rawStatus || Object.hasOwn(statuses, rawStatus), `${row} has unknown status “${value("status")}”. Use planned, active, blocked, done or cancelled.`);
  const budget = amount(value("budget"), `${row} Budget`), forecastCost = amount(value("forecast_cost"), `${row} Forecast cost`);
  const currency = value("currency").toUpperCase() || null;
  ensure(currency === null || /^[A-Z]{3}$/.test(currency), `${row} Currency must be a three-letter code such as USD.`);
  ensure((budget === null && forecastCost === null) || currency, `${row} needs an explicit Currency for money values.`);
  const sourceUrl = value("source_url") || null;
  if (sourceUrl) {
    let url: URL;
    try { url = new URL(sourceUrl); } catch { throw new Error(`${row} Source URL must be an http or https URL.`); }
    ensure(["http:", "https:"].includes(url.protocol) && !url.username && !url.password, `${row} Source URL must be an http or https URL without credentials.`);
  }
  const dependsOn = dependencies(value("depends_on"), `${row} Dependencies`);
  ensure(!dependsOn.includes(id), `${row} cannot depend on itself.`);
  return { id, title, project, owner: text(value("owner"), `${row} Owner`, 160, true), status: rawStatus ? statuses[rawStatus] : "planned", dueDate: value("due_date") ? date(value("due_date"), `${row} Due date`) : null, forecastDate: value("forecast_date") ? date(value("forecast_date"), `${row} Forecast date`) : null, budget, forecastCost, currency, dependsOn, decision: text(value("decision"), `${row} Decision`, MAX_CELL, true), updatedAt: updatedDate(value("updated_at"), `${row} Updated at`), sourceUrl, sourceRow: index + 1, cells };
}
export function buildProjectSnapshot(parsed: ParsedProjectInput, selected: ProjectMapping, options: { name: string; asOf: string; importedAt?: string; id?: string }): ProjectSnapshot {
  const headings = columns(parsed.columns), selectedColumns = mapping(selected, headings);
  ensure(Array.isArray(parsed.rows) && parsed.rows.length > 0 && parsed.rows.length <= MAX_ROWS, `Use 1–${MAX_ROWS} project records.`);
  const records = parsed.rows.map((row, i) => normalize(rawCells(row, headings, `Data row ${i + 1}`), selectedColumns, i));
  ensure(new Set(records.map(record => record.id)).size === records.length, "Record IDs must be unique. Add explicit IDs when project and title repeat.");
  return {
    id: text(options.id ?? `snapshot-${crypto.randomUUID()}`, "Snapshot ID", 200),
    name: text(options.name.trim(), "Source name", 160), asOf: date(options.asOf, "As of"),
    importedAt: instant(options.importedAt ?? new Date().toISOString(), "Imported at"),
    records, columns: headings, mapping: selectedColumns,
  };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
export function validateProjectSnapshot(input: unknown): ProjectSnapshot {
  const value = shape(input, "Project snapshot", ["id", "name", "asOf", "importedAt", "records", "columns", "mapping"]);
  const headings = columns(value.columns), selected = mapping(value.mapping, headings);
  ensure(Array.isArray(value.records) && value.records.length > 0 && value.records.length <= MAX_ROWS, `Use 1–${MAX_ROWS} project records.`);
  const rows = value.records.map((row, i) => {
    const record = shape(row, `Record ${i + 1}`, ["id", "title", "project", "owner", "status", "dueDate", "forecastDate", "budget", "forecastCost", "currency", "dependsOn", "decision", "updatedAt", "sourceUrl", "sourceRow", "cells"]);
    return rawCells(record.cells, headings, `Record ${i + 1} cells`);
  });
  const rebuilt = buildProjectSnapshot({ columns: headings, rows, format: "csv" }, selected, {
    id: text(value.id, "Snapshot ID", 200), name: text(value.name, "Source name", 160), asOf: date(value.asOf, "As of"), importedAt: instant(value.importedAt, "Imported at"),
  });
  ensure(canonical(rebuilt.records) === canonical(value.records), "Project records do not reproduce from their original cells and column mapping.");
  return rebuilt;
}
export function validateProjectData(input: unknown): ProjectData {
  const value = shape(input, "Project data", ["version", "snapshots", "responses"]);
  ensure(value.version === 1, "Unsupported project data version.");
  ensure(Array.isArray(value.snapshots) && value.snapshots.length > 0 && value.snapshots.length <= 8, "Keep 1–8 project snapshots.");
  const snapshots = value.snapshots.map(validateProjectSnapshot);
  ensure(new Set(snapshots.map(snapshot => snapshot.id)).size === snapshots.length, "Project snapshot IDs must be unique.");
  ensure(Array.isArray(value.responses) && value.responses.length <= 500, "Keep at most 500 project responses.");
  const responses = value.responses.map((item, i): ProjectResponse => {
    const name = `Response ${i + 1}`, response = shape(item, name, ["id", "findingId", "fingerprint", "snapshotId", "decision", "reviewDate", "createdAt"]);
    const result = { id: text(response.id, `${name} ID`, 200), findingId: text(response.findingId, `${name} finding ID`, 300), fingerprint: text(response.fingerprint, `${name} fingerprint`, 160), snapshotId: text(response.snapshotId, `${name} snapshot ID`, 200), decision: text(response.decision, `${name} decision`, MAX_CELL), reviewDate: date(response.reviewDate, `${name} review date`), createdAt: instant(response.createdAt, `${name} created at`) };
    ensure(snapshots.some(snapshot => snapshot.id === result.snapshotId), `${name} references a missing snapshot.`);
    return result;
  });
  ensure(new Set(responses.map(response => response.id)).size === responses.length, "Project response IDs must be unique.");
  return { version: 1, snapshots, responses };
}
