"""Read-only probes for the planner behavior observed during the audit.

Run from the repository root:
PYTHONPATH=packages/schemas/src:services/planner/src .venv/bin/python docs/audits/2026-09-12/kernel_probes.py

These print observed behavior; they do not prescribe the corrected policy.
"""

import json
from datetime import UTC, datetime

from zenith_planner.planner import generate_stub_plan
from zenith_schemas.planning import PlanningRequest, WorkerFact, WorkOrderFact

redundant_crew = generate_stub_plan(
    PlanningRequest(
        workers=[
            WorkerFact(worker_id=name, display_name=name, skill_codes=["a", "b", "c"])
            for name in ["A", "B"]
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="job",
                title="One-person job",
                required_worker_count=1,
                required_skill_codes=["a", "b", "c"],
            )
        ],
    )
)

due_only = generate_stub_plan(
    PlanningRequest(
        workers=[WorkerFact(worker_id="A", display_name="A")],
        work_orders=[
            WorkOrderFact(
                work_order_id=str(index),
                title=f"Due-only job {index}",
                due_at=datetime(2026, 9, 12, 12, tzinfo=UTC),
            )
            for index in range(2)
        ],
    )
)

print(json.dumps({
    "redundant_crew": redundant_crew.model_dump(mode="json"),
    "due_only_intervals": due_only.model_dump(mode="json"),
}, indent=2))
