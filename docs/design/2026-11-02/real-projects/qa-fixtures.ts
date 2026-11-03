// Disposable acceptance inputs. These are test fixtures, never seeded into the product.
const rows = [
  { id: "lab", project: "Platform", title: "Certification laboratory", owner: "Maya", status: "active", due_date: "2026-11-15", forecast_date: "2026-12-02", budget: 100000, forecast_cost: 130000, currency: "USD", depends_on: "", decision: "", updated_at: "2026-11-02", notes: "Report names a lost slot; do not infer replacement capacity" },
  { id: "rollout", project: "Customer rollout", title: "First customer deployment", owner: "Luca", status: "blocked", due_date: "2026-11-20", forecast_date: "2026-12-10", budget: "", forecast_cost: "", currency: "", depends_on: "lab", decision: "Choose a revised launch commitment", updated_at: "2026-11-02", notes: "Customer approval needed before changing terms" },
  { id: "funding", project: "Customer rollout", title: "Support coverage", owner: "Nora", status: "active", due_date: "2026-12-15", forecast_date: "2026-12-15", budget: 80000, forecast_cost: 90000, currency: "EUR", depends_on: "", decision: "", updated_at: "2026-11-02", notes: "Do not combine separate budgets or currencies" },
  { id: "done", project: "Platform", title: "Security gate", owner: "Rae", status: "done", due_date: "2026-10-01", forecast_date: "2026-10-15", budget: 20000, forecast_cost: 25000, currency: "USD", depends_on: "", decision: "Old request should stay closed", updated_at: "2026-10-15", notes: "Completed work must not resurface" },
  { id: "undated", project: "Customer rollout", title: "Consent confirmation", owner: "", status: "", due_date: "", forecast_date: "", budget: "", forecast_cost: "", currency: "", depends_on: "external-contract", decision: "", updated_at: "", notes: "No status or dates supplied" },
];
const fields = Object.keys(rows[0]) as (keyof typeof rows[0])[];
const cell = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
const csv = (records: typeof rows) => `${fields.join(",")}\r\n${records.map(row => fields.map(field => cell(row[field])).join(",")).join("\r\n")}\r\n`;
const directory = "/private/tmp/zenith-project-qa";
await Bun.write(`${directory}/portfolio.csv`, csv(rows));
const updated = structuredClone(rows);
updated[0].forecast_date = "2027-01-05"; updated[0].forecast_cost = 160000;
updated[1].forecast_date = "2027-01-10";
await Bun.write(`${directory}/updated.csv`, csv(updated));
await Bun.write(`${directory}/small.json`, JSON.stringify([{ id: "simple", title: "Agree publication rights", project: "Archive", decision: "Who can approve the release?" }], null, 2));
await Bun.write(`${directory}/invalid.csv`, "title,project,due_date\nCommitment,Launch,2026-02-30\n");
await Bun.write(`${directory}/removed.csv`, csv(updated.slice(0, 2)));
console.log("five disposable project-import fixtures written");
