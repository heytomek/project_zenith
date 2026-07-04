from zenith_planner.planner import generate_stub_plan
from zenith_schemas.planning import (
    EquipmentUnitFact,
    MaterialAvailabilityFact,
    PlanningRequest,
    WorkerFact,
    WorkOrderDependencyFact,
    WorkOrderFact,
)


def test_stub_plan_assigns_best_available_worker() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(worker_id="w-1", display_name="Alex", skill_codes=["electrical"]),
            WorkerFact(worker_id="w-2", display_name="Jordan", skill_codes=["plumbing", "electrical"]),
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Repair pump",
                required_skill_codes=["electrical"],
                priority=10,
            )
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 1
    assert result.assignments[0].worker_id == "w-1"


def test_stub_plan_respects_certifications_and_schedule_windows() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                skill_levels={"electrical": 4},
                certification_codes=["osha-10"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T12:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
            WorkerFact(
                worker_id="w-2",
                display_name="Jordan",
                skill_codes=["electrical"],
                skill_levels={"electrical": 5},
                certification_codes=[],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T13:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Repair pump",
                required_skill_codes=["electrical"],
                required_skill_levels={"electrical": 3},
                required_certification_codes=["osha-10"],
                priority=10,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            )
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 1
    assert result.assignments[0].worker_id == "w-1"


def test_stub_plan_reuses_worker_for_non_overlapping_work() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            )
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Repair pump",
                required_skill_codes=["electrical"],
                priority=20,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T10:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="Inspect panel",
                required_skill_codes=["electrical"],
                priority=10,
                requested_start_at="2026-03-10T10:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 2
    assert result.assignments[0].worker_id == "w-1"
    assert result.assignments[1].worker_id == "w-1"


def test_stub_plan_respects_unavailable_windows() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    },
                    {
                        "start_at": "2026-03-10T09:00:00Z",
                        "end_at": "2026-03-10T11:00:00Z",
                        "availability_type": "unavailable",
                    },
                ],
            )
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Repair pump",
                required_skill_codes=["electrical"],
                priority=20,
                requested_start_at="2026-03-10T09:30:00Z",
                due_at="2026-03-10T10:30:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 0
    assert result.unassigned[0].reason == "No available worker satisfies the required skills, certifications, and schedule."


def test_stub_plan_optimizes_for_global_assignment_coverage() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical", "plumbing"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
            WorkerFact(
                worker_id="w-2",
                display_name="Zed",
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Electrical inspection",
                required_skill_codes=["electrical"],
                priority=20,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="Plumbing repair",
                required_skill_codes=["plumbing"],
                priority=10,
                requested_start_at="2026-03-10T09:30:00Z",
                due_at="2026-03-10T10:30:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)
    assignments_by_work_order = {
        assignment.work_order_id: assignment.worker_id for assignment in result.assignments
    }

    assert result.status == "completed"
    assert len(result.assignments) == 2
    assert assignments_by_work_order == {"wo-1": "w-2", "wo-2": "w-1"}


def test_stub_plan_blocks_dependency_that_violates_schedule() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            )
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Upstream repair",
                required_skill_codes=["electrical"],
                priority=20,
                requested_start_at="2026-03-10T10:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="Downstream inspection",
                required_skill_codes=["electrical"],
                priority=10,
                requested_start_at="2026-03-10T10:30:00Z",
                due_at="2026-03-10T11:30:00Z",
            ),
        ],
        dependencies=[
            WorkOrderDependencyFact(
                predecessor_work_order_id="wo-1",
                successor_work_order_id="wo-2",
                dependency_type="finish_to_start",
            )
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 1
    assert result.unassigned[0].work_order_id == "wo-2"
    assert "requires the successor to start after the predecessor finishes" in result.unassigned[0].reason


def test_stub_plan_consumes_material_inventory() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            )
        ],
        materials=[
            MaterialAvailabilityFact(material_code="copper-wire", location_id="loc-1", available_quantity=1)
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Repair one",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                required_material_quantities={"copper-wire": 1},
                priority=20,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T10:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="Repair two",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                required_material_quantities={"copper-wire": 1},
                priority=10,
                requested_start_at="2026-03-10T10:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 1
    assert result.assignments[0].reserved_material_quantities == {"copper-wire": 1}
    assert result.unassigned[0].work_order_id == "wo-2"
    assert "Insufficient material 'copper-wire'" in result.unassigned[0].reason


def test_stub_plan_reuses_equipment_only_when_time_windows_allow() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            )
        ],
        equipment_units=[
            EquipmentUnitFact(
                equipment_id="eq-1",
                equipment_type_code="bucket-truck",
                location_id="loc-1",
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            )
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Pole repair",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                required_equipment_type_quantities={"bucket-truck": 1},
                priority=20,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T10:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="Transformer check",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                required_equipment_type_quantities={"bucket-truck": 1},
                priority=10,
                requested_start_at="2026-03-10T10:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-3",
                title="Emergency splice",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                required_equipment_type_quantities={"bucket-truck": 1},
                priority=5,
                requested_start_at="2026-03-10T09:30:00Z",
                due_at="2026-03-10T10:30:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 2
    assert result.assignments[0].reserved_equipment_ids == ["eq-1"]
    assert result.assignments[1].reserved_equipment_ids == ["eq-1"]
    assert result.unassigned[0].work_order_id == "wo-3"
    assert "Insufficient equipment type 'bucket-truck'" in result.unassigned[0].reason


def test_stub_plan_assigns_multi_worker_crew_for_quantity_requirements() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                skill_levels={"electrical": 4},
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
            WorkerFact(
                worker_id="w-2",
                display_name="Jordan",
                skill_codes=["electrical"],
                skill_levels={"electrical": 5},
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Two-person line repair",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                required_skill_quantities={"electrical": 2},
                required_skill_levels={"electrical": 3},
                required_worker_count=2,
                priority=20,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            )
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 1
    assert result.assignments[0].crew_size_required == 2
    assert result.assignments[0].crew_worker_ids == ["w-1", "w-2"]
    assert result.assignments[0].matched_skill_codes == ["electrical"]


def test_stub_plan_combines_complementary_skills_across_crew() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
            WorkerFact(
                worker_id="w-2",
                display_name="Jordan",
                skill_codes=["plumbing"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T17:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Pump rebuild",
                location_id="loc-1",
                required_skill_codes=["electrical", "plumbing"],
                required_skill_quantities={"electrical": 1, "plumbing": 1},
                required_worker_count=1,
                priority=20,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            )
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 1
    assert result.assignments[0].crew_worker_ids == ["w-1", "w-2"]
    assert result.assignments[0].matched_skill_codes == ["electrical", "plumbing"]


def test_stub_plan_respects_site_to_site_travel_constraints() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                home_location_id="loc-a",
                home_location_latitude=0.0,
                home_location_longitude=0.0,
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T18:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
            WorkerFact(
                worker_id="w-2",
                display_name="Jordan",
                home_location_id="loc-b",
                home_location_latitude=0.0,
                home_location_longitude=1.0,
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T18:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="North site repair",
                location_id="loc-a",
                location_latitude=0.0,
                location_longitude=0.0,
                required_skill_codes=["electrical"],
                priority=30,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T10:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="South site repair",
                location_id="loc-b",
                location_latitude=0.0,
                location_longitude=1.0,
                required_skill_codes=["electrical"],
                priority=25,
                requested_start_at="2026-03-10T10:30:00Z",
                due_at="2026-03-10T11:30:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)
    assignments_by_work_order = {
        assignment.work_order_id: assignment.worker_id for assignment in result.assignments
    }

    assert result.status == "completed"
    assert len(result.assignments) == 2
    assert assignments_by_work_order == {"wo-1": "w-1", "wo-2": "w-2"}


def test_stub_plan_balances_workload_and_avoids_overtime() -> None:
    request = PlanningRequest(
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                daily_regular_capacity_minutes=480,
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T21:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
            WorkerFact(
                worker_id="w-2",
                display_name="Jordan",
                daily_regular_capacity_minutes=480,
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T21:00:00Z",
                        "availability_type": "available",
                    }
                ],
            ),
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Shift one",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                priority=30,
                requested_start_at="2026-03-10T08:00:00Z",
                due_at="2026-03-10T12:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="Shift two",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                priority=20,
                requested_start_at="2026-03-10T12:00:00Z",
                due_at="2026-03-10T16:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-3",
                title="Shift three",
                location_id="loc-1",
                required_skill_codes=["electrical"],
                priority=10,
                requested_start_at="2026-03-10T16:00:00Z",
                due_at="2026-03-10T20:00:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)
    minutes_by_worker: dict[str, int] = {}
    for assignment in result.assignments:
        duration_minutes = 240
        for worker_id in assignment.crew_worker_ids:
            minutes_by_worker[worker_id] = minutes_by_worker.get(worker_id, 0) + duration_minutes

    assert result.status == "completed"
    assert len(result.assignments) == 3
    assert set(minutes_by_worker) == {"w-1", "w-2"}
    assert max(minutes_by_worker.values()) <= 480


def test_stub_plan_uses_horizon_regular_capacity_for_overtime_estimation() -> None:
    request = PlanningRequest(
        window_start="2026-03-10T08:00:00Z",
        window_end="2026-03-10T18:00:00Z",
        workers=[
            WorkerFact(
                worker_id="w-1",
                display_name="Alex",
                daily_regular_capacity_minutes=480,
                planning_regular_capacity_minutes=60,
                skill_codes=["electrical"],
                availability_windows=[
                    {
                        "start_at": "2026-03-10T08:00:00Z",
                        "end_at": "2026-03-10T18:00:00Z",
                        "availability_type": "available",
                    }
                ],
            )
        ],
        work_orders=[
            WorkOrderFact(
                work_order_id="wo-1",
                title="Morning visit",
                required_skill_codes=["electrical"],
                priority=20,
                requested_start_at="2026-03-10T09:00:00Z",
                due_at="2026-03-10T10:00:00Z",
            ),
            WorkOrderFact(
                work_order_id="wo-2",
                title="Late morning visit",
                required_skill_codes=["electrical"],
                priority=20,
                requested_start_at="2026-03-10T10:00:00Z",
                due_at="2026-03-10T11:00:00Z",
            ),
        ],
    )

    result = generate_stub_plan(request)

    assert result.status == "completed"
    assert len(result.assignments) == 2
    assert sum(assignment.estimated_overtime_minutes for assignment in result.assignments) > 0
