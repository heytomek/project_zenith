import { describe, expect, test } from "bun:test";
import {
  buildProjectSnapshot, parseProjectInput, suggestProjectMapping, validateProjectData, validateProjectSnapshot,
  type ProjectData, type ProjectSnapshot,
} from "../../apps/web/lib/coordination/project-data";

const importedAt = "2026-11-02T15:30:00.000Z";
const options = { name: "Portfolio review.csv", asOf: "2026-11-02", importedAt, id: "snapshot-original" };
const source = 'ID,Project,Title,Owner,Status,Due date,Forecast date,Budget,Forecast cost,Currency,Depends on,Decision,Updated at,Source URL,Comment\r\n' +
  'GATE-1,North line,Approve tooling,Nadia Park,Done,2026-10-20,,100000,98000,USD,,Retain signed supplier terms,2026-10-20,https://example.org/gates/1,"Signed, verified"\r\n' +
  'LAUNCH-1,North line,"Launch \"\"Cedar\"\"\r\nline",Evan Reed,In progress,2026-11-10,2026-12-01,"1,250,000","1,470,000",usd,GATE-1,Choose a revised launch or reduce scope,2026-11-02T01:15:00+05:30,https://example.org/launch,"Supplier slot moved; council review pending"\r\n';
function snapshot(text = source): ProjectSnapshot {
  const parsed = parseProjectInput(text);
  return buildProjectSnapshot(parsed, suggestProjectMapping(parsed.columns), options);
}
const data = (snapshots = [snapshot()]): ProjectData => ({ version: 1, snapshots, responses: [] });

describe("real project source snapshots", () => {
  test("numeric dependency IDs cannot silently lose precision", () => {
    const parsed = parseProjectInput('[{"id":"release","project":"Launch","title":"Release","depends_on":[9007199254740993]}]');
    expect(() => buildProjectSnapshot(parsed, suggestProjectMapping(parsed.columns), options)).toThrow("safe integer IDs");
    const quoted = parseProjectInput('[{"id":"release","project":"Launch","title":"Release","depends_on":["9007199254740993"]}]');
    expect(buildProjectSnapshot(quoted, suggestProjectMapping(quoted.columns), options).records[0].dependsOn).toEqual(["9007199254740993"]);
  });
  test("quoted CSV preserves multiline evidence, escaped quotes, UTF-8 and source cells", () => {
    const parsed = parseProjectInput(`\uFEFF${source}`);
    expect(parsed.format).toBe("csv");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[1].Title).toBe('Launch "Cedar"\r\nline');
    const saved = buildProjectSnapshot(parsed, suggestProjectMapping(parsed.columns), options);
    expect(saved.records[0].status).toBe("done");
    expect(saved.records[1]).toMatchObject({
      id: "LAUNCH-1", project: "North line", owner: "Evan Reed", status: "active",
      dueDate: "2026-11-10", forecastDate: "2026-12-01", budget: 1_250_000,
      forecastCost: 1_470_000, currency: "USD", dependsOn: ["GATE-1"], updatedAt: "2026-11-01", sourceRow: 2,
    });
    expect(saved.records[1].cells.Currency).toBe("usd");
    expect(saved.records[1].cells["Updated at"]).toBe("2026-11-02T01:15:00+05:30");
    expect(saved.records[1].cells.Comment).toBe("Supplier slot moved; council review pending");
    expect(saved.mapping.forecast_date).toBe("Forecast date");
    expect(validateProjectData(data([saved]))).toEqual(data([saved]));
  });

  test("JSON records preserve unknown fields and do not execute spreadsheet or HTML text", () => {
    const parsed = parseProjectInput(JSON.stringify({ records: [
      { id: 42, project: "Café access", title: "=IMPORTXML(https://example.org)", status: "blocked", depends_on: ["legal", "consent"], notes: { risk: "<script>alert(1)</script>" } },
      { id: "legal", project: "Café access", title: "Confirm terms", status: "planned" },
    ] }));
    const saved = buildProjectSnapshot(parsed, suggestProjectMapping(parsed.columns), options);
    expect(parsed.format).toBe("json");
    expect(saved.records[0].id).toBe("42");
    expect(saved.records[0].title).toBe("=IMPORTXML(https://example.org)");
    expect(saved.records[0].dependsOn).toEqual(["legal", "consent"]);
    expect(saved.records[0].cells.notes).toBe('{"risk":"<script>alert(1)</script>"}');
    expect(saved.records[1].cells.notes).toBe("");
    expect(validateProjectSnapshot(saved)).toEqual(saved);
    expect(parseProjectInput('[{"project":"A","title":"B"}]').rows).toEqual([{ project: "A", title: "B" }]);
    expect(() => parseProjectInput('[{"id":9007199254740993,"project":"A","title":"B"}]')).toThrow("Quote large IDs");
    expect(parseProjectInput('[{"id":"9007199254740993","project":"A","title":"B"}]').rows[0].id).toBe("9007199254740993");
  });

  test("missing optional values remain explicit and source-backed instead of becoming simulated facts", () => {
    const saved = snapshot("Project,Title,Owner,Status,Budget,Forecast cost,Currency\nHarbor,Choose a supplier,,,,,\n");
    expect(saved.records[0]).toMatchObject({ owner: "", status: "planned", dueDate: null, forecastDate: null, budget: null, forecastCost: null, currency: null, dependsOn: [], decision: "", updatedAt: null, sourceUrl: null });
    expect(saved.records[0].cells.Status).toBe("");
    expect(saved.records[0]).not.toHaveProperty("progress");
    expect(saved.records[0]).not.toHaveProperty("observedFactor");
    expect(saved.records[0]).not.toHaveProperty("effects");
    const unpaired = snapshot("Project,Title,Budget,Currency\nHarbor,Approve room,2500,EUR");
    expect(unpaired.records[0].forecastCost).toBeNull();
  });

  test("generated IDs are stable across reordering and evidence refresh; ambiguous duplicate titles require IDs", () => {
    const initial = snapshot("Project,Title,Status\n東京,Approve lease,planned\nB,Launch trial,active");
    const refreshed = snapshot("Project,Title,Status\nB,Launch trial,blocked\n東京,Approve lease,active");
    expect(initial.records[0].id).toBe(refreshed.records[1].id);
    expect(initial.records[1].id).toBe(refreshed.records[0].id);
    expect(initial.records[0].id).not.toBe(initial.records[1].id);
    expect(() => snapshot("Project,Title\nA,Repeated\nA,Repeated")).toThrow("explicit IDs");
    expect(() => snapshot("ID,Project,Title\nSAME,A,First\nSAME,B,Second")).toThrow("unique");
    const explicit = snapshot("ID,Project,Title\nONE,A,Repeated\nTWO,A,Repeated");
    expect(explicit.records.map(record => record.id)).toEqual(["ONE", "TWO"]);
  });

  test("strict dates reject calendar overflow and ambiguous formats, but updated timestamps preserve UTC dates", () => {
    for (const value of ["2026-02-29", "2026-02-30", "2026-13-01", "11/02/2026", "2026-11-02T12:00:00Z"])
      expect(() => snapshot(`Project,Title,Due date\nA,B,${value}`)).toThrow("YYYY-MM-DD");
    expect(snapshot("Project,Title,Due date\nA,B,2028-02-29").records[0].dueDate).toBe("2028-02-29");
    expect(snapshot("Project,Title,Updated at\nA,B,2026-11-02T23:30:00-03:00").records[0].updatedAt).toBe("2026-11-03");
    expect(snapshot("Project,Title,Updated at\nA,B,2026-11-02T12:30:00.123456Z").records[0].updatedAt).toBe("2026-11-02");
    for (const value of ["2026-02-30T12:30:00Z", "2026-11-02T24:00:00Z", "2026-11-02T12:00:00", "2026-11-02T12:00:00+05:90"])
      expect(() => snapshot(`Project,Title,Updated at\nA,B,${value}`)).toThrow();
  });

  test("money requires declared units and valid finite nonnegative amounts", () => {
    for (const value of ["-1", "Infinity", "NaN", "1e999", "$100", "12,50", "1e16"])
      expect(() => snapshot(`Project,Title,Budget,Currency\nA,B,"${value}",USD`)).toThrow();
    expect(() => snapshot("Project,Title,Budget\nA,B,100")).toThrow("Currency");
    expect(() => snapshot("Project,Title,Forecast cost\nA,B,100")).toThrow("Currency");
    expect(() => snapshot("Project,Title,Budget,Currency\nA,B,100,dollars")).toThrow("three-letter");
    expect(snapshot("Project,Title,Budget,Currency\nA,B,0,EUR").records[0].budget).toBe(0);
    expect(snapshot("Project,Title,Budget,Currency\nA,B,1e3,GBP").records[0].budget).toBe(1000);
  });

  test("unknown dependencies remain source-quality gaps rather than fabricated linked work", () => {
    const saved = snapshot('ID,Project,Title,Depends on\nA,One,Launch,"MISSING; OTHER"');
    expect(saved.records[0].dependsOn).toEqual(["MISSING", "OTHER"]);
    expect(validateProjectSnapshot(saved)).toEqual(saved);
    expect(() => snapshot('ID,Project,Title,Depends on\nA,One,Launch,"A"')).toThrow("itself");
    expect(() => snapshot('ID,Project,Title,Depends on\nA,One,Launch,"B;B"')).toThrow("repeats");
    expect(() => snapshot('ID,Project,Title,Depends on\nA,One,Launch,"B;"')).toThrow("empty");
  });

  test("malformed CSV, ambiguous columns, unknown statuses and unsafe URLs are rejected before persistence", () => {
    for (const value of [
      'Project,Title\nA,"Open', 'Project,Title\nA,"Closed"tail', 'Project,Title\nA,Un"escaped',
      "Project,Title\nA", "Project,Title\nA,B,C", "Project,title, Title \nA,B,C", "Project,,Title\nA,B,C",
      "Project,Title", "", "\uFEFF", "Project,Title\n,,",
    ]) expect(() => parseProjectInput(value)).toThrow();
    expect(() => snapshot("Project,Title,Status\nA,B,probably done")).toThrow("unknown status");
    for (const value of ["javascript:alert(1)", "file:///tmp/private", "https://user:password@example.org/", "/project/42"])
      expect(() => snapshot(`Project,Title,Source URL\nA,B,${value}`)).toThrow("http");
  });

  test("source size, row count, cell and column bounds hold across CSV and JSON", () => {
    expect(() => parseProjectInput("é".repeat(1_000_001))).toThrow("2 MB");
    expect(() => parseProjectInput(`Project,Title\n${Array.from({ length: 501 }, (_, i) => `A,T${i}`).join("\n")}`)).toThrow("500");
    expect(() => parseProjectInput(JSON.stringify(Array.from({ length: 501 }, (_, i) => ({ project: "A", title: `T${i}` }))))).toThrow("500");
    expect(() => parseProjectInput(`Project,Title\nA,${"x".repeat(4001)}`)).toThrow("4000");
    expect(() => parseProjectInput(`${Array.from({ length: 65 }, (_, i) => `C${i}`).join(",")}\n${Array(65).fill("A").join(",")}`)).toThrow("64");
    const exact = parseProjectInput(`Project,Title\n${Array.from({ length: 500 }, (_, i) => `A,T${i}`).join("\n")}`);
    expect(buildProjectSnapshot(exact, suggestProjectMapping(exact.columns), options).records).toHaveLength(500);
  });

  test("mapping is explicit, required fields cannot be guessed, and prototype-named cells remain plain data", () => {
    const parsed = parseProjectInput("Group,Work,Forecast,__proto__\nA,B,1200,literal");
    expect(suggestProjectMapping(parsed.columns)).toEqual({});
    expect(() => buildProjectSnapshot(parsed, {}, options)).toThrow("Title and Project");
    expect(() => buildProjectSnapshot(parsed, { title: "Work", project: "Missing" }, options)).toThrow("unknown column");
    const saved = buildProjectSnapshot(parsed, { title: "Work", project: "Group" }, options);
    expect(Object.hasOwn(saved.records[0].cells, "__proto__")).toBe(true);
    expect(saved.records[0].cells.__proto__).toBe("literal");
    expect(saved.records[0].forecastDate).toBeNull();
    expect(saved.records[0].forecastCost).toBeNull();
    expect(validateProjectSnapshot(saved)).toEqual(saved);
    expect(() => buildProjectSnapshot(parsed, { title: "Work", project: "Group", injected: "Forecast" } as never, options)).toThrow("unsupported");
  });

  test("portable snapshots reject fabricated normalized values and altered source-to-record associations", () => {
    for (const alter of [
      (saved: ProjectSnapshot) => { saved.records[1].forecastCost = 1; },
      (saved: ProjectSnapshot) => { saved.records[1].status = "done"; },
      (saved: ProjectSnapshot) => { saved.records[1].dependsOn = []; },
      (saved: ProjectSnapshot) => { saved.records[1].sourceRow = 1; },
      (saved: ProjectSnapshot) => { saved.mapping.forecast_date = "Due date"; },
      (saved: ProjectSnapshot) => { delete saved.records[1].cells.Comment; },
      (saved: ProjectSnapshot) => { (saved.records[1] as unknown as Record<string, unknown>).authorized = true; },
    ]) {
      const saved = snapshot(); alter(saved);
      expect(() => validateProjectSnapshot(saved)).toThrow();
    }
    expect(validateProjectData(JSON.parse(JSON.stringify(data())))).toEqual(data());
  });

  test("refresh retains prior source evidence and responses are tied to an existing reviewed snapshot", () => {
    const original = snapshot();
    const changed = snapshot(source.replace('"1,470,000"', '"1,300,000"'));
    changed.id = "snapshot-refreshed";
    changed.importedAt = "2026-11-03T15:30:00.000Z";
    changed.asOf = "2026-11-03";
    const history = data([original, changed]);
    history.responses.push({ id: "response-1", findingId: "project:North line:budget", fingerprint: "rules-v1:1234567890abcdef", snapshotId: original.id, decision: "Retain the safety scope; request revised funding approval.", reviewDate: "2026-11-02", createdAt: "2026-11-02T17:00:00.000Z" });
    const restored = validateProjectData(history);
    expect(restored.snapshots[0].records[1].forecastCost).toBe(1_470_000);
    expect(restored.snapshots[1].records[1].forecastCost).toBe(1_300_000);
    expect(restored.responses[0].snapshotId).toBe(original.id);
    expect(() => validateProjectData({ ...history, snapshots: [changed] })).toThrow("missing snapshot");
    expect(() => validateProjectData({ ...history, snapshots: [original, original] })).toThrow("unique");
    expect(() => validateProjectData({ ...history, responses: [history.responses[0], history.responses[0]] })).toThrow("unique");
    expect(() => validateProjectData({ ...history, responses: [{ ...history.responses[0], reviewDate: "2026-02-30" }] })).toThrow("YYYY-MM-DD");
    expect(() => validateProjectData({ ...history, responses: [{ ...history.responses[0], decision: " " }] })).toThrow("non-empty");
    expect(() => validateProjectData({ ...history, version: 2 })).toThrow("Unsupported");
    expect(() => validateProjectData({ ...history, snapshots: Array(9).fill(original) })).toThrow("1–8");
  });
});
