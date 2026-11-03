# Bring real project data

choose **Bring project data** on first entry, or **Bring data** in the workspace picker. upload a CSV/JSON export or use **Paste data**. confirm Workspace and Report date, map Title and Project, inspect the preview, then Open. optional mappings live under Columns. the file and review stay in this browser; no provider key or external upload is involved.

use commitments, milestones or requested decisions as records. each row needs a non-empty title and project; a project can appear in many rows. the source may use different header names because the mapping is explicit. unknown columns stay available in Original record.

## CSV template

the import dialog's **Template** action downloads `zenith-project.csv` with this header only:

```csv
id,title,project,owner,status,due_date,forecast_date,budget,forecast_cost,currency,depends_on,decision,updated_at,source_url
```

add your own rows. comma-separated CSV supports a UTF-8 BOM, quoted commas, doubled inner quotes and quoted multiline cells. source record numbers count data records starting at one, excluding the header; a multiline record is one record.

| Field | Meaning and format |
| --- | --- |
| `title`, `project` | required, non-empty commitment title and project name |
| `id` | optional stable ID, unique across the complete snapshot; use explicit IDs for dependencies or repeated project/title pairs |
| `owner` | named accountable party from the source; this is not authenticated authority |
| `status` | `planned`, `active`, `blocked`, `done` or `cancelled`; common aliases such as `To do`, `In progress`, `Complete` and `Canceled` are accepted |
| `due_date`, `forecast_date` | declared commitment and current forecast, in `YYYY-MM-DD` format; ambiguous dates are rejected |
| `budget`, `forecast_cost`, `currency` | nonnegative numeric amounts and an explicit three-letter currency code such as `USD`; the funding comparison requires both amounts in that currency |
| `depends_on` | upstream record IDs separated by semicolons or commas; a JSON array is also accepted |
| `decision` | the source's explicit question or request for judgment |
| `updated_at` | `YYYY-MM-DD` or an RFC3339 timestamp; timestamps normalize to the UTC date while the original cell remains available |
| `source_url` | optional `http`/`https` link without embedded credentials; opening a link is a separate user action |

blank optional values stay absent. a blank status displays **Unstated**, with an explicit source-coverage gap; the normalized internal `planned` fallback cannot establish that an overdue commitment remains unfinished. a missing budget or forecast does not become zero. no currency conversion or cross-record budget total is inferred. unknown statuses fail validation rather than being guessed.

without an ID, the combination of project and title generates a stable identity. reordering rows preserves it; changing the project or title changes it. duplicate generated identities require explicit IDs. missing dependency references appear as source gaps, not invented delays or completed work.

## JSON

use an array of records or `{ "records": [...] }`. fields use the same mapping as CSV. this illustrative record is not loaded automatically:

```json
[
  {
    "id": "launch-1",
    "title": "Release the customer pilot",
    "project": "Cedar",
    "owner": "Nadia Park",
    "status": "active",
    "due_date": "2026-12-01",
    "forecast_date": "2026-12-15",
    "budget": 120000,
    "forecast_cost": 135000,
    "currency": "USD",
    "depends_on": ["security-review"],
    "decision": "Should we revise the pilot date or reduce its scope?",
    "updated_at": "2026-11-02T15:30:00Z"
  }
]
```

quote large numeric IDs as strings to preserve their digits. `security-review` in this example is intentionally absent; include its actual record to review the dependency window.

## Review and refresh

Attention groups findings by project and concrete condition. the Commitments agent checks declared deadline conflicts, explicitly unfinished overdue records and requested decisions; Resources compares explicit forecasts with budgets; Dependencies checks named upstream work against downstream commitments. top avatars disclose the rules. these are deterministic local reviewers, not LLM interpretation or free-form document extraction.

review recomputes on import, refresh and opening, with date checks while the app stays open. it does not fetch sources or monitor them after the browser closes. each decision opens its cited records and Basis. record a judgment in Record without changing source facts, marking work complete, authorizing spending or sending instructions to another system.

**Refresh data** accepts a complete new snapshot, rather than merging row patches. it retains the existing mapping when those columns still exist and preserves previous snapshots in Sources. the report date cannot move backward; open older data as a separate workspace. missing rows are absent from the current evidence, not proof of completion.

unchanged relevant facts remain Reviewed. changed review facts, a newly overdue condition, or a condition that disappeared and later recurs need fresh judgment. prior responses remain tied to the exact source snapshot and review date, so historical reasoning stays inspectable.

## Limits and portability

each source accepts up to 500 data records, 64 columns and 2 MB of UTF-8 input. each project retains up to 8 snapshots and 500 responses. portable workspace/library exports also have a 2 MB limit, including retained history; a smaller current source can therefore still exceed the complete export limit. browser storage capacity is finite.

exports include source cells, mappings, normalized records and judgments in the existing version-two library. validation reproduces records from cells and mapping, then checks responses against their cited findings. a checksum establishes consistency, not source truth or authorship. existing modeled cases, worked histories and earlier archived files remain supported.

live connectors, remote or LLM agents, authenticated decision makers, shared server persistence and external project-system execution remain future work. real-project mode creates no synthetic causal effects, resource reservations, mandates or outcomes.
