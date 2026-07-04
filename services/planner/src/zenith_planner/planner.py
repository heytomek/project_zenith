from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from itertools import combinations
from math import asin, ceil, cos, radians, sin, sqrt

from ortools.sat.python import cp_model
from zenith_schemas.planning import (
    AvailabilityWindowFact,
    CandidateAssignment,
    EquipmentUnitFact,
    PlanningRequest,
    PlanRunSummary,
    UnassignedWork,
    WorkerFact,
    WorkOrderDependencyFact,
    WorkOrderFact,
)

SUPPORTED_DEPENDENCY_TYPES = {
    "finish_to_start",
    "start_to_start",
    "finish_to_finish",
    "start_to_finish",
}

WORK_ORDER_OBJECTIVE_WEIGHT = 1_000_000
WORK_ORDER_PRIORITY_WEIGHT = 10_000
MATCH_SCORE_WEIGHT = 100
STAFFING_PENALTY_WEIGHT = 250
HOME_TRAVEL_PENALTY_WEIGHT = 3
TRANSITION_TRAVEL_PENALTY_WEIGHT = 2
OVERTIME_PENALTY_WEIGHT = 75
MAX_LOAD_PENALTY_WEIGHT = 2
DEFAULT_TRAVEL_SPEED_KMH = 45
DEFAULT_WORK_DURATION_MINUTES = 60


@dataclass(frozen=True)
class WorkerCandidate:
    worker: WorkerFact
    matched_skill_codes: list[str]
    matched_certification_codes: list[str]
    score: int
    worker_index: int


@dataclass(frozen=True)
class WorkOrderFeasibility:
    work_order: WorkOrderFact
    candidates: list[WorkerCandidate]
    resource_reason: str | None
    dependency_timing_reason: str | None
    eligible_equipment_units_by_type: dict[str, list[EquipmentUnitFact]]


def generate_stub_plan(request: PlanningRequest) -> PlanRunSummary:
    """
    Solve a fixed-window draft schedule with crew sizing, travel, overtime, and
    workload-balancing considerations.
    """

    assignments: list[CandidateAssignment] = []
    unassigned: list[UnassignedWork] = []
    issues: list[str] = []

    workers = sorted(request.workers, key=lambda item: (item.display_name, item.worker_id))
    worker_lookup = {worker.worker_id: worker for worker in workers}
    work_order_lookup = {work_order.work_order_id: work_order for work_order in request.work_orders}

    if not workers:
        issues.append("No workers were supplied to the planner.")
    if not request.work_orders:
        issues.append("No work orders were supplied to the planner.")

    dependencies, dependency_issues = _normalize_dependencies(request, work_order_lookup)
    issues.extend(dependency_issues)

    ordered_work_orders, cycle_detected = _topologically_sorted_work_orders(
        request.work_orders,
        dependencies,
    )
    if cycle_detected:
        issues.append("Planner request contains cyclic dependencies, so no schedule could be produced.")
        return PlanRunSummary(status="failed", assignments=[], unassigned=[], issues=issues)

    material_inventory = {
        (material.location_id, material.material_code): material.available_quantity
        for material in request.materials
    }
    equipment_units = sorted(
        request.equipment_units,
        key=lambda item: (item.equipment_type_code, item.location_id, item.equipment_id),
    )
    dependency_map = _incoming_dependencies_by_successor(dependencies)
    feasibility_by_work_order = _build_feasibility_map(
        ordered_work_orders,
        workers,
        dependencies,
        material_inventory,
        equipment_units,
    )
    horizon_days = _planning_horizon_days(request, ordered_work_orders)

    model = cp_model.CpModel()
    selected_by_work_order: dict[str, cp_model.IntVar] = {}
    assignment_var_by_pair: dict[tuple[str, str], cp_model.IntVar] = {}
    equipment_var_by_pair: dict[tuple[str, str], cp_model.IntVar] = {}
    worker_minutes_vars: dict[str, cp_model.IntVar] = {}
    worker_overtime_vars: dict[str, cp_model.IntVar] = {}
    objective_terms: list[cp_model.LinearExpr] = []

    max_possible_minutes = sum(
        _planned_duration_minutes(work_order) * max(1, work_order.required_worker_count)
        for work_order in ordered_work_orders
    )
    max_assigned_minutes = model.NewIntVar(0, max_possible_minutes, "max_assigned_minutes")

    for work_order in ordered_work_orders:
        feasibility = feasibility_by_work_order[work_order.work_order_id]
        selected = model.NewBoolVar(f"selected__{work_order.work_order_id}")
        selected_by_work_order[work_order.work_order_id] = selected

        candidate_assignment_vars: list[cp_model.IntVar] = []
        for candidate in feasibility.candidates:
            variable = model.NewBoolVar(
                f"assign__{work_order.work_order_id}__{candidate.worker.worker_id}"
            )
            assignment_var_by_pair[(work_order.work_order_id, candidate.worker.worker_id)] = variable
            candidate_assignment_vars.append(variable)
            home_travel_minutes = _home_to_work_travel_minutes(candidate.worker, work_order)
            objective_terms.append(
                variable
                * (
                    candidate.score * MATCH_SCORE_WEIGHT
                    - STAFFING_PENALTY_WEIGHT
                    - home_travel_minutes * HOME_TRAVEL_PENALTY_WEIGHT
                    + (len(workers) - candidate.worker_index)
                )
            )

        if candidate_assignment_vars:
            model.Add(sum(candidate_assignment_vars) >= work_order.required_worker_count * selected)
            model.Add(sum(candidate_assignment_vars) <= len(candidate_assignment_vars) * selected)
        else:
            model.Add(selected == 0)

        if feasibility.resource_reason is not None or feasibility.dependency_timing_reason is not None:
            model.Add(selected == 0)

        objective_terms.append(
            selected * (WORK_ORDER_OBJECTIVE_WEIGHT + max(work_order.priority, 0) * WORK_ORDER_PRIORITY_WEIGHT)
        )

        for skill_code, required_quantity in sorted(_required_skill_quantities(work_order).items()):
            skill_worker_vars = [
                assignment_var_by_pair[(work_order.work_order_id, candidate.worker.worker_id)]
                for candidate in feasibility.candidates
                if skill_code in candidate.matched_skill_codes
            ]
            if skill_worker_vars:
                model.Add(sum(skill_worker_vars) >= required_quantity * selected)
            else:
                model.Add(selected == 0)

        for certification_code, required_quantity in sorted(
            _required_certification_quantities(work_order).items()
        ):
            certification_worker_vars = [
                assignment_var_by_pair[(work_order.work_order_id, candidate.worker.worker_id)]
                for candidate in feasibility.candidates
                if certification_code in candidate.matched_certification_codes
            ]
            if certification_worker_vars:
                model.Add(sum(certification_worker_vars) >= required_quantity * selected)
            else:
                model.Add(selected == 0)

        for equipment_type_code, required_quantity in sorted(
            work_order.required_equipment_type_quantities.items()
        ):
            eligible_units = feasibility.eligible_equipment_units_by_type.get(equipment_type_code, [])
            equipment_vars: list[cp_model.IntVar] = []
            for equipment_unit in eligible_units:
                variable = model.NewBoolVar(
                    f"equipment__{work_order.work_order_id}__{equipment_unit.equipment_id}"
                )
                equipment_var_by_pair[(work_order.work_order_id, equipment_unit.equipment_id)] = variable
                equipment_vars.append(variable)
            if equipment_vars:
                model.Add(sum(equipment_vars) == required_quantity * selected)
            else:
                model.Add(selected == 0)

    for dependency in dependencies:
        predecessor_var = selected_by_work_order[dependency.predecessor_work_order_id]
        successor_var = selected_by_work_order[dependency.successor_work_order_id]
        model.Add(successor_var <= predecessor_var)

    for worker in workers:
        worker_candidate_work_orders = [
            feasibility.work_order
            for feasibility in feasibility_by_work_order.values()
            if (feasibility.work_order.work_order_id, worker.worker_id) in assignment_var_by_pair
        ]

        worker_minutes_terms: list[cp_model.LinearExpr] = []
        for work_order in worker_candidate_work_orders:
            duration_minutes = _planned_duration_minutes(work_order)
            worker_minutes_terms.append(
                assignment_var_by_pair[(work_order.work_order_id, worker.worker_id)] * duration_minutes
            )

        worker_minutes_var = model.NewIntVar(
            0,
            max_possible_minutes,
            f"worker_minutes__{worker.worker_id}",
        )
        if worker_minutes_terms:
            model.Add(worker_minutes_var == sum(worker_minutes_terms))
        else:
            model.Add(worker_minutes_var == 0)
        worker_minutes_vars[worker.worker_id] = worker_minutes_var
        model.Add(max_assigned_minutes >= worker_minutes_var)

        regular_capacity_minutes = max(
            0,
            worker.planning_regular_capacity_minutes
            if worker.planning_regular_capacity_minutes is not None
            else worker.daily_regular_capacity_minutes * horizon_days,
        )
        worker_overtime_var = model.NewIntVar(
            0,
            max_possible_minutes,
            f"worker_overtime__{worker.worker_id}",
        )
        model.Add(worker_overtime_var >= worker_minutes_var - regular_capacity_minutes)
        model.Add(worker_overtime_var >= 0)
        worker_overtime_vars[worker.worker_id] = worker_overtime_var
        objective_terms.append(worker_overtime_var * -OVERTIME_PENALTY_WEIGHT)

        for left_work_order, right_work_order in combinations(worker_candidate_work_orders, 2):
            left_key = (left_work_order.work_order_id, worker.worker_id)
            right_key = (right_work_order.work_order_id, worker.worker_id)
            left_var = assignment_var_by_pair[left_key]
            right_var = assignment_var_by_pair[right_key]
            transition = _worker_transition_requirement(worker, left_work_order, right_work_order)
            if not transition.can_coexist:
                model.Add(left_var + right_var <= 1)
                continue
            if transition.penalty_minutes <= 0:
                continue
            pair_var = model.NewBoolVar(
                f"travel_pair__{worker.worker_id}__{left_work_order.work_order_id}__{right_work_order.work_order_id}"
            )
            model.Add(pair_var <= left_var)
            model.Add(pair_var <= right_var)
            model.Add(pair_var >= left_var + right_var - 1)
            objective_terms.append(pair_var * -(transition.penalty_minutes * TRANSITION_TRAVEL_PENALTY_WEIGHT))

    objective_terms.append(max_assigned_minutes * -MAX_LOAD_PENALTY_WEIGHT)

    for (location_id, material_code), available_quantity in sorted(material_inventory.items()):
        material_terms: list[cp_model.LinearExpr] = []
        for work_order in ordered_work_orders:
            required_quantity = work_order.required_material_quantities.get(material_code)
            if required_quantity is None or work_order.location_id != location_id:
                continue
            material_terms.append(selected_by_work_order[work_order.work_order_id] * required_quantity)
        if material_terms:
            model.Add(sum(material_terms) <= available_quantity)

    for equipment_unit in equipment_units:
        equipment_work_orders = [
            feasibility.work_order
            for feasibility in feasibility_by_work_order.values()
            if equipment_unit.equipment_id
            in {
                candidate_unit.equipment_id
                for units in feasibility.eligible_equipment_units_by_type.values()
                for candidate_unit in units
            }
        ]
        for left_work_order, right_work_order in combinations(equipment_work_orders, 2):
            if _work_orders_overlap(left_work_order, right_work_order):
                left_key = (left_work_order.work_order_id, equipment_unit.equipment_id)
                right_key = (right_work_order.work_order_id, equipment_unit.equipment_id)
                if left_key in equipment_var_by_pair and right_key in equipment_var_by_pair:
                    model.Add(equipment_var_by_pair[left_key] + equipment_var_by_pair[right_key] <= 1)

    model.Maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    solver.parameters.num_search_workers = 8
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        issues.append("Optimization planner could not find a feasible assignment plan.")
        return PlanRunSummary(status="failed", assignments=[], unassigned=[], issues=issues)

    for work_order in ordered_work_orders:
        feasibility = feasibility_by_work_order[work_order.work_order_id]
        selected = solver.Value(selected_by_work_order[work_order.work_order_id]) == 1
        if not selected:
            unassigned.append(
                UnassignedWork(
                    work_order_id=work_order.work_order_id,
                    reason=_unassigned_reason(
                        work_order,
                        feasibility,
                        dependency_map.get(work_order.work_order_id, []),
                        selected_by_work_order,
                        solver,
                        worker_lookup,
                    ),
                )
            )
            continue

        chosen_candidates = sorted(
            [
                candidate
                for candidate in feasibility.candidates
                if solver.Value(
                    assignment_var_by_pair[(work_order.work_order_id, candidate.worker.worker_id)]
                )
                == 1
            ],
            key=_selected_candidate_sort_key,
        )
        lead_candidate = chosen_candidates[0]
        reserved_equipment_ids = [
            equipment_unit.equipment_id
            for equipment_type_code in sorted(work_order.required_equipment_type_quantities)
            for equipment_unit in feasibility.eligible_equipment_units_by_type.get(
                equipment_type_code, []
            )
            if solver.Value(equipment_var_by_pair[(work_order.work_order_id, equipment_unit.equipment_id)])
            == 1
        ]
        interval_start, interval_end = _work_interval(work_order)
        crew_worker_ids = [candidate.worker.worker_id for candidate in chosen_candidates]
        crew_worker_names = [candidate.worker.display_name for candidate in chosen_candidates]
        crew_skill_codes = sorted(
            {
                code
                for candidate in chosen_candidates
                for code in candidate.matched_skill_codes
            }
        )
        crew_certification_codes = sorted(
            {
                code
                for candidate in chosen_candidates
                for code in candidate.matched_certification_codes
            }
        )
        assignments.append(
            CandidateAssignment(
                work_order_id=work_order.work_order_id,
                worker_id=lead_candidate.worker.worker_id,
                worker_name=lead_candidate.worker.display_name,
                crew_worker_ids=crew_worker_ids,
                crew_worker_names=crew_worker_names,
                crew_size_required=work_order.required_worker_count,
                score=sum(candidate.score for candidate in chosen_candidates),
                matched_skill_codes=crew_skill_codes,
                matched_certification_codes=crew_certification_codes,
                reserved_material_quantities=dict(work_order.required_material_quantities),
                reserved_equipment_ids=reserved_equipment_ids,
                scheduled_start_at=_as_utc(interval_start) if interval_start is not None else None,
                scheduled_end_at=_as_utc(interval_end) if interval_end is not None else None,
                estimated_travel_minutes=sum(
                    _home_to_work_travel_minutes(candidate.worker, work_order)
                    for candidate in chosen_candidates
                ),
                estimated_overtime_minutes=sum(
                    _assignment_overtime_share_minutes(
                        candidate.worker,
                        work_order,
                        solver.Value(worker_minutes_vars[candidate.worker.worker_id]),
                        horizon_days,
                    )
                    for candidate in chosen_candidates
                ),
            )
        )

    issues.append(
        "Optimization planner created "
        f"{len(assignments)} assignments, left {len(unassigned)} work orders unassigned, "
        "and optimized crew sizing, travel, overtime, and workload balance."
    )

    return PlanRunSummary(
        status="completed",
        assignments=assignments,
        unassigned=unassigned,
        issues=issues,
    )


def _build_feasibility_map(
    work_orders: list[WorkOrderFact],
    workers: list[WorkerFact],
    dependencies: list[WorkOrderDependencyFact],
    material_inventory: dict[tuple[str, str], int],
    equipment_units: list[EquipmentUnitFact],
) -> dict[str, WorkOrderFeasibility]:
    work_order_lookup = {work_order.work_order_id: work_order for work_order in work_orders}
    timing_block_reasons = _dependency_timing_reasons(dependencies, work_order_lookup)
    feasibility_by_work_order: dict[str, WorkOrderFeasibility] = {}

    for work_order in work_orders:
        candidates: list[WorkerCandidate] = []
        for worker_index, worker in enumerate(workers):
            if not worker.available:
                continue
            if not _worker_is_scheduled_for_work(worker.availability_windows, work_order):
                continue

            matched_skill_codes = _matched_skill_codes(worker, work_order)
            matched_certification_codes = _matched_certification_codes(worker, work_order)
            has_explicit_labor_requirements = bool(
                _required_skill_quantities(work_order) or _required_certification_quantities(work_order)
            )
            if has_explicit_labor_requirements and not matched_skill_codes and not matched_certification_codes:
                continue

            candidates.append(
                WorkerCandidate(
                    worker=worker,
                    matched_skill_codes=matched_skill_codes,
                    matched_certification_codes=matched_certification_codes,
                    score=len(matched_skill_codes) + len(matched_certification_codes),
                    worker_index=worker_index,
                )
            )

        resource_reason, eligible_equipment_units_by_type = _resource_feasibility(
            work_order,
            material_inventory,
            equipment_units,
        )
        feasibility_by_work_order[work_order.work_order_id] = WorkOrderFeasibility(
            work_order=work_order,
            candidates=candidates,
            resource_reason=resource_reason,
            dependency_timing_reason=timing_block_reasons.get(work_order.work_order_id),
            eligible_equipment_units_by_type=eligible_equipment_units_by_type,
        )

    return feasibility_by_work_order


def _normalize_dependencies(
    request: PlanningRequest,
    work_order_lookup: dict[str, WorkOrderFact],
) -> tuple[list[WorkOrderDependencyFact], list[str]]:
    dependencies: list[WorkOrderDependencyFact] = []
    issues: list[str] = []

    for dependency in request.dependencies:
        if dependency.predecessor_work_order_id not in work_order_lookup:
            issues.append(
                "Planner request includes dependency with unknown predecessor "
                f"{dependency.predecessor_work_order_id}."
            )
            continue
        if dependency.successor_work_order_id not in work_order_lookup:
            issues.append(
                "Planner request includes dependency with unknown successor "
                f"{dependency.successor_work_order_id}."
            )
            continue
        if dependency.dependency_type not in SUPPORTED_DEPENDENCY_TYPES:
            issues.append(
                f"Planner request includes unsupported dependency type '{dependency.dependency_type}'."
            )
            continue
        dependencies.append(dependency)

    return dependencies, issues


def _topologically_sorted_work_orders(
    work_orders: list[WorkOrderFact],
    dependencies: list[WorkOrderDependencyFact],
) -> tuple[list[WorkOrderFact], bool]:
    work_order_lookup = {work_order.work_order_id: work_order for work_order in work_orders}
    indegree = {work_order.work_order_id: 0 for work_order in work_orders}
    outgoing: dict[str, list[str]] = {work_order.work_order_id: [] for work_order in work_orders}

    for dependency in dependencies:
        outgoing[dependency.predecessor_work_order_id].append(dependency.successor_work_order_id)
        indegree[dependency.successor_work_order_id] += 1

    ready = sorted(
        [work_order_lookup[work_order_id] for work_order_id, count in indegree.items() if count == 0],
        key=_work_order_sort_key,
    )
    ordered: list[WorkOrderFact] = []

    while ready:
        current = ready.pop(0)
        ordered.append(current)
        for successor_id in sorted(outgoing[current.work_order_id]):
            indegree[successor_id] -= 1
            if indegree[successor_id] == 0:
                ready.append(work_order_lookup[successor_id])
        ready.sort(key=_work_order_sort_key)

    return ordered, len(ordered) != len(work_orders)


def _work_order_sort_key(work_order: WorkOrderFact) -> tuple[int, datetime, str, str]:
    interval_start, interval_end = _work_interval(work_order)
    scheduled_time = interval_start or interval_end or datetime.max.replace(tzinfo=UTC)
    return (-work_order.priority, _as_utc(scheduled_time), work_order.title.lower(), work_order.work_order_id)


def _incoming_dependencies_by_successor(
    dependencies: list[WorkOrderDependencyFact],
) -> dict[str, list[WorkOrderDependencyFact]]:
    dependency_map: dict[str, list[WorkOrderDependencyFact]] = {}
    for dependency in dependencies:
        dependency_map.setdefault(dependency.successor_work_order_id, []).append(dependency)
    return dependency_map


def _dependency_timing_reasons(
    dependencies: list[WorkOrderDependencyFact],
    work_order_lookup: dict[str, WorkOrderFact],
) -> dict[str, str]:
    reasons: dict[str, str] = {}
    for dependency in dependencies:
        predecessor_work_order = work_order_lookup[dependency.predecessor_work_order_id]
        successor_work_order = work_order_lookup[dependency.successor_work_order_id]
        reason = _dependency_timing_violation(
            dependency,
            predecessor_work_order,
            successor_work_order,
        )
        if reason is not None:
            reasons[dependency.successor_work_order_id] = reason
    return reasons


def _dependency_timing_violation(
    dependency: WorkOrderDependencyFact,
    predecessor_work_order: WorkOrderFact,
    successor_work_order: WorkOrderFact,
) -> str | None:
    predecessor_start, predecessor_end = _work_interval(predecessor_work_order)
    successor_start, successor_end = _work_interval(successor_work_order)

    if (
        predecessor_start is None
        or predecessor_end is None
        or successor_start is None
        or successor_end is None
    ):
        return (
            f"Dependency {dependency.predecessor_work_order_id} -> {dependency.successor_work_order_id} "
            "could not be validated because one or both work orders lack a complete schedule window."
        )

    predecessor_start = _as_utc(predecessor_start)
    predecessor_end = _as_utc(predecessor_end)
    successor_start = _as_utc(successor_start)
    successor_end = _as_utc(successor_end)

    if dependency.dependency_type == "finish_to_start" and successor_start < predecessor_end:
        return (
            f"Dependency {dependency.predecessor_work_order_id} -> {dependency.successor_work_order_id} "
            "requires the successor to start after the predecessor finishes."
        )
    if dependency.dependency_type == "start_to_start" and successor_start < predecessor_start:
        return (
            f"Dependency {dependency.predecessor_work_order_id} -> {dependency.successor_work_order_id} "
            "requires the successor to start after the predecessor starts."
        )
    if dependency.dependency_type == "finish_to_finish" and successor_end < predecessor_end:
        return (
            f"Dependency {dependency.predecessor_work_order_id} -> {dependency.successor_work_order_id} "
            "requires the successor to finish after the predecessor finishes."
        )
    if dependency.dependency_type == "start_to_finish" and successor_end < predecessor_start:
        return (
            f"Dependency {dependency.predecessor_work_order_id} -> {dependency.successor_work_order_id} "
            "requires the successor to finish after the predecessor starts."
        )
    return None


def _resource_feasibility(
    work_order: WorkOrderFact,
    material_inventory: dict[tuple[str, str], int],
    equipment_units: list[EquipmentUnitFact],
) -> tuple[str | None, dict[str, list[EquipmentUnitFact]]]:
    if work_order.location_id is None and (
        work_order.required_material_quantities or work_order.required_equipment_type_quantities
    ):
        return "Work order resource requirements require a location_id.", {}

    for material_code, required_quantity in sorted(work_order.required_material_quantities.items()):
        inventory_key = (work_order.location_id, material_code)
        if material_inventory.get(inventory_key, 0) < required_quantity:
            return (
                f"Insufficient material '{material_code}' available at location {work_order.location_id}.",
                {},
            )

    eligible_equipment_units_by_type: dict[str, list[EquipmentUnitFact]] = {}
    for equipment_type_code, required_quantity in sorted(work_order.required_equipment_type_quantities.items()):
        candidates = [
            equipment_unit
            for equipment_unit in equipment_units
            if equipment_unit.available
            and equipment_unit.location_id == work_order.location_id
            and equipment_unit.equipment_type_code == equipment_type_code
            and _worker_is_scheduled_for_work(equipment_unit.availability_windows, work_order)
        ]
        if len(candidates) < required_quantity:
            return (
                f"Insufficient equipment type '{equipment_type_code}' available at location {work_order.location_id}.",
                {},
            )
        eligible_equipment_units_by_type[equipment_type_code] = candidates

    return None, eligible_equipment_units_by_type


@dataclass(frozen=True)
class WorkerTransitionRequirement:
    can_coexist: bool
    penalty_minutes: int = 0


def _worker_transition_requirement(
    worker: WorkerFact,
    left_work_order: WorkOrderFact,
    right_work_order: WorkOrderFact,
) -> WorkerTransitionRequirement:
    del worker
    left_start, left_end = _work_interval(left_work_order)
    right_start, right_end = _work_interval(right_work_order)
    if (
        left_start is None
        or left_end is None
        or right_start is None
        or right_end is None
    ):
        return WorkerTransitionRequirement(can_coexist=False)

    if _intervals_overlap(left_start, left_end, right_start, right_end):
        return WorkerTransitionRequirement(can_coexist=False)

    if _as_utc(left_end) <= _as_utc(right_start):
        earlier, later = left_work_order, right_work_order
    elif _as_utc(right_end) <= _as_utc(left_start):
        earlier, later = right_work_order, left_work_order
    else:
        return WorkerTransitionRequirement(can_coexist=False)

    travel_minutes = _travel_minutes_between_work_orders(earlier, later)
    if travel_minutes <= 0:
        return WorkerTransitionRequirement(can_coexist=True, penalty_minutes=0)

    earlier_start, earlier_end = _work_interval(earlier)
    later_start, later_end = _work_interval(later)
    if earlier_end is None or later_start is None or later_end is None or earlier_start is None:
        return WorkerTransitionRequirement(can_coexist=False)
    available_gap_minutes = int((_as_utc(later_start) - _as_utc(earlier_end)).total_seconds() // 60)
    if travel_minutes > max(0, available_gap_minutes):
        return WorkerTransitionRequirement(can_coexist=False)
    return WorkerTransitionRequirement(can_coexist=True, penalty_minutes=travel_minutes)


def _work_orders_overlap(left_work_order: WorkOrderFact, right_work_order: WorkOrderFact) -> bool:
    return not _intervals_can_coexist(_work_interval(left_work_order), _work_interval(right_work_order))


def _intervals_overlap(
    left_start: datetime,
    left_end: datetime,
    right_start: datetime,
    right_end: datetime,
) -> bool:
    left_start = _as_utc(left_start)
    left_end = _as_utc(left_end)
    right_start = _as_utc(right_start)
    right_end = _as_utc(right_end)
    return left_start < right_end and right_start < left_end


def _intervals_can_coexist(
    existing_interval: tuple[datetime | None, datetime | None],
    proposed_interval: tuple[datetime | None, datetime | None],
) -> bool:
    existing_start, existing_end = existing_interval
    proposed_start, proposed_end = proposed_interval

    if (
        existing_start is None
        or existing_end is None
        or proposed_start is None
        or proposed_end is None
    ):
        return False

    existing_start = _as_utc(existing_start)
    existing_end = _as_utc(existing_end)
    proposed_start = _as_utc(proposed_start)
    proposed_end = _as_utc(proposed_end)

    return proposed_end <= existing_start or proposed_start >= existing_end


def _worker_is_scheduled_for_work(
    availability_windows: list[AvailabilityWindowFact],
    work_order: WorkOrderFact,
) -> bool:
    if not availability_windows:
        return True

    interval_start, interval_end = _work_interval(work_order)
    available_windows = [
        window for window in availability_windows if window.availability_type == "available"
    ]
    unavailable_windows = [
        window for window in availability_windows if window.availability_type != "available"
    ]

    if interval_start is None or interval_end is None:
        if available_windows:
            return True
        return not bool(unavailable_windows)

    has_available_coverage = True
    if available_windows:
        has_available_coverage = any(
            _window_covers_interval(window, interval_start, interval_end)
            for window in available_windows
        )
    if not has_available_coverage:
        return False

    return not any(
        _intervals_overlap(
            window.start_at,
            window.end_at,
            interval_start,
            interval_end,
        )
        for window in unavailable_windows
    )


def _window_covers_interval(
    window: AvailabilityWindowFact,
    interval_start: datetime,
    interval_end: datetime,
) -> bool:
    return _as_utc(window.start_at) <= _as_utc(interval_start) and _as_utc(window.end_at) >= _as_utc(
        interval_end
    )


def _matched_skill_codes(worker: WorkerFact, work_order: WorkOrderFact) -> list[str]:
    matched_skill_codes: list[str] = []
    fallback_skill_codes = set(worker.skill_codes)

    for code in sorted(_required_skill_quantities(work_order)):
        required_level = work_order.required_skill_levels.get(code, 1)
        worker_level = worker.skill_levels.get(code, 1 if code in fallback_skill_codes else 0)
        if worker_level < required_level:
            continue
        matched_skill_codes.append(code)

    return matched_skill_codes


def _matched_certification_codes(worker: WorkerFact, work_order: WorkOrderFact) -> list[str]:
    return sorted(
        set(_required_certification_quantities(work_order)).intersection(worker.certification_codes)
    )


def _required_skill_quantities(work_order: WorkOrderFact) -> dict[str, int]:
    if work_order.required_skill_quantities:
        return {
            code: max(quantity, 1)
            for code, quantity in work_order.required_skill_quantities.items()
        }
    return {code: 1 for code in work_order.required_skill_codes}


def _required_certification_quantities(work_order: WorkOrderFact) -> dict[str, int]:
    if work_order.required_certification_quantities:
        return {
            code: max(quantity, 1)
            for code, quantity in work_order.required_certification_quantities.items()
        }
    return {code: 1 for code in work_order.required_certification_codes}


def _work_interval(work_order: WorkOrderFact) -> tuple[datetime | None, datetime | None]:
    interval_start = work_order.requested_start_at or work_order.due_at
    interval_end = work_order.due_at or work_order.requested_start_at
    return interval_start, interval_end


def _planned_duration_minutes(work_order: WorkOrderFact) -> int:
    start_at, end_at = _work_interval(work_order)
    if start_at is None or end_at is None:
        return DEFAULT_WORK_DURATION_MINUTES
    duration_minutes = int((_as_utc(end_at) - _as_utc(start_at)).total_seconds() // 60)
    return max(duration_minutes, DEFAULT_WORK_DURATION_MINUTES)


def _planning_horizon_days(request: PlanningRequest, work_orders: list[WorkOrderFact]) -> int:
    horizon_start = request.window_start
    horizon_end = request.window_end
    if horizon_start is None:
        work_starts = [
            _as_utc(start_at)
            for work_order in work_orders
            for start_at, _ in [_work_interval(work_order)]
            if start_at is not None
        ]
        if work_starts:
            horizon_start = min(work_starts)
    if horizon_end is None:
        work_ends = [
            _as_utc(end_at)
            for work_order in work_orders
            for _, end_at in [_work_interval(work_order)]
            if end_at is not None
        ]
        if work_ends:
            horizon_end = max(work_ends)
    if horizon_start is None or horizon_end is None:
        return 1
    return max(1, (_as_utc(horizon_end).date() - _as_utc(horizon_start).date()).days + 1)


def _home_to_work_travel_minutes(worker: WorkerFact, work_order: WorkOrderFact) -> int:
    if worker.home_location_id is not None and worker.home_location_id == work_order.location_id:
        return 0
    return _travel_minutes_between_points(
        worker.home_location_latitude,
        worker.home_location_longitude,
        work_order.location_latitude,
        work_order.location_longitude,
    )


def _travel_minutes_between_work_orders(
    left_work_order: WorkOrderFact,
    right_work_order: WorkOrderFact,
) -> int:
    if left_work_order.location_id is not None and left_work_order.location_id == right_work_order.location_id:
        return 0
    return _travel_minutes_between_points(
        left_work_order.location_latitude,
        left_work_order.location_longitude,
        right_work_order.location_latitude,
        right_work_order.location_longitude,
    )


def _travel_minutes_between_points(
    left_latitude: float | None,
    left_longitude: float | None,
    right_latitude: float | None,
    right_longitude: float | None,
) -> int:
    if (
        left_latitude is None
        or left_longitude is None
        or right_latitude is None
        or right_longitude is None
    ):
        return 0
    distance_km = _haversine_km(left_latitude, left_longitude, right_latitude, right_longitude)
    if distance_km <= 0:
        return 0
    return max(1, ceil(distance_km / DEFAULT_TRAVEL_SPEED_KMH * 60))


def _haversine_km(
    left_latitude: float,
    left_longitude: float,
    right_latitude: float,
    right_longitude: float,
) -> float:
    earth_radius_km = 6371.0
    delta_latitude = radians(right_latitude - left_latitude)
    delta_longitude = radians(right_longitude - left_longitude)
    left_latitude = radians(left_latitude)
    right_latitude = radians(right_latitude)
    a = (
        sin(delta_latitude / 2) ** 2
        + cos(left_latitude) * cos(right_latitude) * sin(delta_longitude / 2) ** 2
    )
    return 2 * earth_radius_km * asin(sqrt(a))


def _selected_candidate_sort_key(candidate: WorkerCandidate) -> tuple[int, int, str]:
    return (-candidate.score, candidate.worker_index, candidate.worker.worker_id)


def _assignment_overtime_share_minutes(
    worker: WorkerFact,
    work_order: WorkOrderFact,
    assigned_minutes: int,
    horizon_days: int,
) -> int:
    regular_capacity_minutes = max(
        0,
        worker.planning_regular_capacity_minutes
        if worker.planning_regular_capacity_minutes is not None
        else worker.daily_regular_capacity_minutes * horizon_days,
    )
    if assigned_minutes <= regular_capacity_minutes:
        return 0
    overtime_minutes = assigned_minutes - regular_capacity_minutes
    if assigned_minutes <= 0:
        return 0
    duration_minutes = _planned_duration_minutes(work_order)
    return max(0, round(duration_minutes * overtime_minutes / assigned_minutes))


def _unassigned_reason(
    work_order: WorkOrderFact,
    feasibility: WorkOrderFeasibility,
    dependencies: list[WorkOrderDependencyFact],
    selected_by_work_order: dict[str, cp_model.IntVar],
    solver: cp_model.CpSolver,
    worker_lookup: dict[str, WorkerFact],
) -> str:
    if feasibility.dependency_timing_reason is not None:
        return feasibility.dependency_timing_reason

    for dependency in dependencies:
        predecessor_selected = solver.Value(
            selected_by_work_order[dependency.predecessor_work_order_id]
        ) == 1
        if not predecessor_selected:
            return (
                "Dependency on work order "
                f"{dependency.predecessor_work_order_id} could not be satisfied because the predecessor "
                "was not assigned."
            )

    if feasibility.resource_reason is not None:
        return feasibility.resource_reason

    if len(feasibility.candidates) < work_order.required_worker_count:
        return _no_candidate_reason(work_order, worker_lookup, candidate_count=len(feasibility.candidates))

    if not feasibility.candidates:
        return _no_candidate_reason(work_order, worker_lookup, candidate_count=0)

    capacity_reason = _resource_capacity_reason(work_order)
    if capacity_reason is not None:
        return capacity_reason

    if work_order.required_worker_count > 1:
        return (
            "Optimization could not assign this work order within current labor, travel, overtime, "
            "and crew-capacity limits."
        )
    return "Optimization could not assign this work order within current labor and resource capacity."


def _no_candidate_reason(
    work_order: WorkOrderFact,
    worker_lookup: dict[str, WorkerFact],
    *,
    candidate_count: int,
) -> str:
    del worker_lookup
    has_explicit_requirements = bool(_required_skill_quantities(work_order)) or bool(
        _required_certification_quantities(work_order)
    )
    has_schedule = work_order.requested_start_at is not None or work_order.due_at is not None

    if work_order.required_worker_count > 1 and candidate_count < work_order.required_worker_count:
        if has_explicit_requirements and has_schedule:
            return (
                "Not enough available workers satisfy the required crew size, skills, certifications, "
                "and schedule."
            )
        if has_explicit_requirements:
            return "Not enough available workers satisfy the required crew size, skills, and certifications."
        if has_schedule:
            return "Not enough available workers satisfy the required crew size and schedule."
        return "Not enough available workers remain to staff the required crew size."

    if has_explicit_requirements and has_schedule:
        return "No available worker satisfies the required skills, certifications, and schedule."
    if has_explicit_requirements:
        return "No available worker satisfies the required skills and certifications."
    if has_schedule:
        return "No available worker satisfies the requested schedule."
    return "No available worker remains for assignment."


def _resource_capacity_reason(work_order: WorkOrderFact) -> str | None:
    if work_order.location_id is None:
        return None

    for material_code in sorted(work_order.required_material_quantities):
        return f"Insufficient material '{material_code}' available at location {work_order.location_id}."

    for equipment_type_code in sorted(work_order.required_equipment_type_quantities):
        return (
            f"Insufficient equipment type '{equipment_type_code}' available at location "
            f"{work_order.location_id}."
        )

    return None


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
