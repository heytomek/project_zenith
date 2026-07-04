import csv
from collections.abc import Callable
from datetime import UTC, date, datetime, time, timedelta
from io import StringIO
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session, selectinload
from zenith_planner.planner import generate_stub_plan
from zenith_schemas.planning import (
    AvailabilityWindowFact,
    CandidateAssignment,
    EquipmentUnitFact,
    MaterialAvailabilityFact,
    OperationsAssignmentRow,
    OperationsBottleneckItem,
    OperationsEquipmentBreakdownItem,
    OperationsLocationBreakdownItem,
    OperationsMaterialBreakdownItem,
    OperationsPublishedRunItem,
    OperationsReportFilters,
    OperationsReportRead,
    OperationsReportSummary,
    OperationsTrendPoint,
    OperationsWorkerBreakdownItem,
    OrganizationPlanningRequest,
    PlanActualsBreakdownItem,
    PlanActualsReasonCount,
    PlanActualsReviewItem,
    PlanActualsReviewRead,
    PlanActualsReviewSummary,
    PlanAssignmentBulkHandoffAction,
    PlanAssignmentBulkHandoffResult,
    PlanAssignmentCancellationAction,
    PlanAssignmentEventCreate,
    PlanAssignmentOverrideUpdate,
    PlanAssignmentReassignmentAction,
    PlanDispatchQueueApplyAction,
    PlanDispatchQueueApplyResult,
    PlanDispatchQueueCreate,
    PlanDispatchQueueTemplateCreate,
    PlanDispatchQueueTemplateUpdate,
    PlanDispatchQueueUpdate,
    PlanningHorizonCreate,
    PlanningHorizonUpdate,
    PlanningRequest,
    PlanRunApprovalAction,
    PlanRunAssignmentChange,
    PlanRunComparisonRead,
    PlanRunComparisonSummary,
    PlanRunCreate,
    PlanRunIssueChange,
    PlanRunPublishAction,
    PlanRunReference,
    PlanRunSummary,
    PlanRunUnassignedChange,
    PlanScenarioCreate,
    PlanScenarioUpdate,
    WorkerFact,
    WorkOrderDependencyFact,
    WorkOrderFact,
)

from app.db.models.demand import WorkOrder, WorkOrderDependency
from app.db.models.identity import User, UserRole
from app.db.models.organization import Organization
from app.db.models.planning import (
    PlanAssignment,
    PlanAssignmentEvent,
    PlanDispatchQueue,
    PlanDispatchQueueTemplate,
    PlanEquipmentReservation,
    PlanMaterialReservation,
    PlanningHorizon,
    PlanRun,
    PlanScenario,
    PlanWorkerReservation,
)
from app.db.models.resources import (
    Equipment,
    EquipmentAvailabilityCalendar,
    EquipmentType,
    InventoryPosition,
    Material,
)
from app.db.models.workforce import (
    AvailabilityCalendar,
    Certification,
    Skill,
    Worker,
    WorkerCertification,
    WorkerShiftTemplate,
    WorkerSkill,
)
from app.services.errors import AuthorizationError, ConflictError, NotFoundError, ValidationError


def list_plan_scenarios(session: Session, organization_id: UUID) -> list[PlanScenario]:
    _require_organization(session, organization_id)
    query = (
        select(PlanScenario)
        .where(PlanScenario.organization_id == organization_id)
        .order_by(PlanScenario.updated_at.desc(), PlanScenario.name.asc())
    )
    return list(session.scalars(query))


def list_planning_horizons(session: Session, organization_id: UUID) -> list[PlanningHorizon]:
    _require_organization(session, organization_id)
    query = (
        select(PlanningHorizon)
        .where(PlanningHorizon.organization_id == organization_id)
        .order_by(PlanningHorizon.start_at.desc(), PlanningHorizon.name.asc())
    )
    return list(session.scalars(query))


def create_planning_horizon(
    session: Session,
    organization_id: UUID,
    payload: PlanningHorizonCreate,
) -> PlanningHorizon:
    _require_organization(session, organization_id)
    _validate_horizon_range(payload.start_at, payload.end_at)
    _ensure_unique_planning_horizon_name(session, organization_id, payload.name)
    created_at = datetime.now(UTC)
    horizon = PlanningHorizon(
        organization_id=organization_id,
        created_at=created_at,
        updated_at=created_at,
        **payload.model_dump(),
    )
    session.add(horizon)
    session.commit()
    session.refresh(horizon)
    return horizon


def get_planning_horizon(
    session: Session,
    organization_id: UUID,
    horizon_id: UUID,
) -> PlanningHorizon:
    horizon = session.get(PlanningHorizon, horizon_id)
    if horizon is None or horizon.organization_id != organization_id:
        raise NotFoundError(
            f"Planning horizon {horizon_id} was not found in organization {organization_id}."
        )
    return horizon


def update_planning_horizon(
    session: Session,
    organization_id: UUID,
    horizon_id: UUID,
    payload: PlanningHorizonUpdate,
) -> PlanningHorizon:
    horizon = get_planning_horizon(session, organization_id, horizon_id)
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != horizon.name:
        _ensure_unique_planning_horizon_name(
            session,
            organization_id,
            updates["name"],
            exclude_id=horizon_id,
        )
    _validate_horizon_range(
        updates.get("start_at", horizon.start_at),
        updates.get("end_at", horizon.end_at),
    )
    for field, value in updates.items():
        setattr(horizon, field, value)
    session.commit()
    session.refresh(horizon)
    return horizon


def delete_planning_horizon(session: Session, organization_id: UUID, horizon_id: UUID) -> None:
    get_planning_horizon(session, organization_id, horizon_id)
    horizon_id_string = str(horizon_id)
    scenario_references = list(
        session.scalars(
            select(PlanScenario).where(PlanScenario.organization_id == organization_id)
        )
    )
    run_references = list(
        session.scalars(select(PlanRun).where(PlanRun.organization_id == organization_id))
    )
    for scenario in scenario_references:
        planning_request = scenario.planning_request or {}
        if str(planning_request.get("planning_horizon_id") or "") == horizon_id_string:
            raise ConflictError(
                "Cannot delete a planning horizon that is referenced by an existing scenario."
            )
    for run in run_references:
        planning_request = run.planning_request or {}
        if str(planning_request.get("planning_horizon_id") or "") == horizon_id_string:
            raise ConflictError(
                "Cannot delete a planning horizon that is referenced by an existing run."
            )
    horizon = get_planning_horizon(session, organization_id, horizon_id)
    session.delete(horizon)
    session.commit()


def create_plan_scenario(
    session: Session,
    organization_id: UUID,
    payload: PlanScenarioCreate,
) -> PlanScenario:
    _require_organization(session, organization_id)
    _resolve_planning_window(session, organization_id, payload.planning_request)
    _ensure_unique_plan_scenario_name(session, organization_id, payload.name)
    scenario = PlanScenario(
        organization_id=organization_id,
        name=payload.name,
        description=payload.description,
        notes=payload.notes,
        scenario_type="manual",
        status=payload.status,
        labels=_normalize_scenario_labels(payload.labels),
        planning_request=payload.planning_request.model_dump(mode="json"),
    )
    session.add(scenario)
    session.commit()
    session.refresh(scenario)
    return scenario


def clone_plan_scenario(
    session: Session,
    organization_id: UUID,
    scenario_id: UUID,
) -> PlanScenario:
    source = get_plan_scenario(session, organization_id, scenario_id)
    clone_name = _generate_unique_copy_name(session, organization_id, source.name)
    planning_request = OrganizationPlanningRequest.model_validate(source.planning_request).model_copy(
        update={"scenario_name": clone_name}
    )
    scenario = PlanScenario(
        organization_id=organization_id,
        base_scenario_id=source.id,
        name=clone_name,
        description=source.description,
        notes=source.notes,
        scenario_type="cloned",
        status=source.status,
        labels=list(source.labels or []),
        planning_request=planning_request.model_dump(mode="json"),
    )
    session.add(scenario)
    session.commit()
    session.refresh(scenario)
    return scenario


def get_plan_scenario(session: Session, organization_id: UUID, scenario_id: UUID) -> PlanScenario:
    scenario = session.get(PlanScenario, scenario_id)
    if scenario is None or scenario.organization_id != organization_id:
        raise NotFoundError(
            f"Plan scenario {scenario_id} was not found in organization {organization_id}."
        )
    return scenario


def update_plan_scenario(
    session: Session,
    organization_id: UUID,
    scenario_id: UUID,
    payload: PlanScenarioUpdate,
) -> PlanScenario:
    scenario = get_plan_scenario(session, organization_id, scenario_id)
    updates = payload.model_dump(exclude_unset=True, mode="json")
    if "planning_request" in updates:
        _resolve_planning_window(
            session,
            organization_id,
            OrganizationPlanningRequest.model_validate(updates["planning_request"]),
        )
    if "name" in updates and updates["name"] != scenario.name:
        _ensure_unique_plan_scenario_name(
            session,
            organization_id,
            updates["name"],
            exclude_id=scenario_id,
        )
    if "labels" in updates:
        updates["labels"] = _normalize_scenario_labels(updates["labels"])
    for field, value in updates.items():
        setattr(scenario, field, value)
    session.commit()
    session.refresh(scenario)
    return scenario


def delete_plan_scenario(session: Session, organization_id: UUID, scenario_id: UUID) -> None:
    scenario = get_plan_scenario(session, organization_id, scenario_id)
    has_runs = session.scalar(select(PlanRun.id).where(PlanRun.scenario_id == scenario_id).limit(1))
    if has_runs is not None:
        raise ConflictError("Cannot delete a plan scenario that still has persisted runs.")
    has_children = session.scalar(
        select(PlanScenario.id).where(PlanScenario.base_scenario_id == scenario_id).limit(1)
    )
    if has_children is not None:
        raise ConflictError("Cannot delete a plan scenario that still has child scenarios.")
    session.delete(scenario)
    session.commit()


def list_plan_runs(session: Session, organization_id: UUID) -> list[PlanRun]:
    _require_organization(session, organization_id)
    query = (
        select(PlanRun)
        .where(PlanRun.organization_id == organization_id)
        .order_by(PlanRun.created_at.desc())
    )
    return list(session.scalars(query))


def get_plan_run(session: Session, organization_id: UUID, run_id: UUID) -> PlanRun:
    run = session.get(PlanRun, run_id)
    if run is None or run.organization_id != organization_id:
        raise NotFoundError(f"Plan run {run_id} was not found in organization {organization_id}.")
    return run


def get_latest_plan_run(session: Session, organization_id: UUID) -> PlanRun:
    _require_organization(session, organization_id)
    run = session.scalar(
        select(PlanRun)
        .where(PlanRun.organization_id == organization_id)
        .order_by(PlanRun.created_at.desc())
        .limit(1)
    )
    if run is None:
        raise NotFoundError(f"No persisted plan runs were found in organization {organization_id}.")
    return run


def delete_plan_run(session: Session, organization_id: UUID, run_id: UUID) -> None:
    run = get_plan_run(session, organization_id, run_id)
    if run.publication_status == "published":
        raise ConflictError("Cannot delete a published plan run.")
    session.delete(run)
    session.commit()


def rerun_plan_run(session: Session, organization_id: UUID, run_id: UUID) -> PlanRun:
    run = get_plan_run(session, organization_id, run_id)
    payload = PlanRunCreate.model_validate(
        {
            **run.planning_request,
            "scenario_id": run.scenario_id,
        }
    )
    return create_plan_run(session, organization_id, payload)


def list_plan_assignments(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
) -> list[PlanAssignment]:
    get_plan_run(session, organization_id, run_id)
    query = (
        select(PlanAssignment)
        .where(
            PlanAssignment.organization_id == organization_id,
            PlanAssignment.plan_run_id == run_id,
        )
        .order_by(PlanAssignment.scheduled_start_at.asc(), PlanAssignment.created_at.asc())
    )
    return list(session.scalars(query))


def list_plan_dispatch_queues(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
) -> list[PlanDispatchQueue]:
    get_plan_run(session, organization_id, run_id)
    return list(
        session.scalars(
            select(PlanDispatchQueue)
            .where(
                PlanDispatchQueue.organization_id == organization_id,
                PlanDispatchQueue.plan_run_id == run_id,
            )
            .order_by(PlanDispatchQueue.created_at.asc(), PlanDispatchQueue.name.asc())
        )
    )


def list_plan_dispatch_queue_templates(
    session: Session,
    organization_id: UUID,
) -> list[PlanDispatchQueueTemplate]:
    _require_organization(session, organization_id)
    return list(
        session.scalars(
            select(PlanDispatchQueueTemplate)
            .where(PlanDispatchQueueTemplate.organization_id == organization_id)
            .order_by(PlanDispatchQueueTemplate.created_at.asc(), PlanDispatchQueueTemplate.name.asc())
        )
    )


def create_plan_dispatch_queue_template(
    session: Session,
    organization_id: UUID,
    payload: PlanDispatchQueueTemplateCreate,
) -> PlanDispatchQueueTemplate:
    _require_organization(session, organization_id)
    template_name = payload.name.strip()
    if not template_name:
        raise ValidationError("Dispatch queue template name is required.")
    _ensure_unique_dispatch_queue_template_name(session, organization_id, template_name)
    created_at = datetime.now(UTC)
    template = PlanDispatchQueueTemplate(
        organization_id=organization_id,
        name=template_name,
        description=payload.description,
        status=payload.status.strip(),
        assignment_statuses=_normalize_dispatch_filter_values(payload.assignment_statuses),
        execution_statuses=_normalize_dispatch_filter_values(payload.execution_statuses),
        handoff_statuses=_normalize_dispatch_filter_values(payload.handoff_statuses),
        source_kinds=_normalize_dispatch_filter_values(payload.source_kinds),
        canned_handoff_status=payload.canned_handoff_status,
        allowed_role_codes=_normalize_role_code_values(payload.allowed_role_codes),
        created_at=created_at,
        updated_at=created_at,
    )
    session.add(template)
    session.commit()
    session.refresh(template)
    return template


def get_plan_dispatch_queue_template(
    session: Session,
    organization_id: UUID,
    template_id: UUID,
) -> PlanDispatchQueueTemplate:
    template = session.get(PlanDispatchQueueTemplate, template_id)
    if template is None or template.organization_id != organization_id:
        raise NotFoundError(
            f"Dispatch queue template {template_id} was not found in organization {organization_id}."
        )
    return template


def update_plan_dispatch_queue_template(
    session: Session,
    organization_id: UUID,
    template_id: UUID,
    payload: PlanDispatchQueueTemplateUpdate,
) -> PlanDispatchQueueTemplate:
    template = get_plan_dispatch_queue_template(session, organization_id, template_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data:
        next_name = str(update_data["name"]).strip()
        if next_name != template.name:
            _ensure_unique_dispatch_queue_template_name(
                session,
                organization_id,
                next_name,
                exclude_id=template_id,
            )
            template.name = next_name
    if "description" in update_data:
        template.description = update_data["description"]
    if "status" in update_data:
        template.status = str(update_data["status"]).strip()
    if "assignment_statuses" in update_data:
        template.assignment_statuses = _normalize_dispatch_filter_values(
            update_data["assignment_statuses"]
        )
    if "execution_statuses" in update_data:
        template.execution_statuses = _normalize_dispatch_filter_values(
            update_data["execution_statuses"]
        )
    if "handoff_statuses" in update_data:
        template.handoff_statuses = _normalize_dispatch_filter_values(
            update_data["handoff_statuses"]
        )
    if "source_kinds" in update_data:
        template.source_kinds = _normalize_dispatch_filter_values(update_data["source_kinds"])
    if "canned_handoff_status" in update_data:
        template.canned_handoff_status = update_data["canned_handoff_status"]
    if "allowed_role_codes" in update_data:
        template.allowed_role_codes = _normalize_role_code_values(update_data["allowed_role_codes"])

    session.commit()
    session.refresh(template)
    return template


def delete_plan_dispatch_queue_template(
    session: Session,
    organization_id: UUID,
    template_id: UUID,
) -> None:
    template = get_plan_dispatch_queue_template(session, organization_id, template_id)
    linked_queue = session.scalar(
        select(PlanDispatchQueue.id)
        .where(
            PlanDispatchQueue.organization_id == organization_id,
            PlanDispatchQueue.queue_template_id == template.id,
        )
        .limit(1)
    )
    if linked_queue is not None:
        raise ConflictError(
            "Cannot delete a dispatch queue template while run queues still reference it."
        )
    session.delete(template)
    session.commit()


def create_plan_dispatch_queue(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    payload: PlanDispatchQueueCreate,
) -> PlanDispatchQueue:
    get_plan_run(session, organization_id, run_id)
    template: PlanDispatchQueueTemplate | None = None
    if payload.template_id is not None:
        template = get_plan_dispatch_queue_template(session, organization_id, payload.template_id)

    queue_name = payload.name.strip() if payload.name is not None else None
    if queue_name is None and template is not None:
        queue_name = template.name
    if queue_name is None or not queue_name.strip():
        raise ValidationError(
            "Dispatch queue creation requires a name, or a template with an inherited name."
        )
    _ensure_unique_dispatch_queue_name(session, organization_id, run_id, queue_name)

    created_at = datetime.now(UTC)
    queue = PlanDispatchQueue(
        organization_id=organization_id,
        plan_run_id=run_id,
        queue_template_id=template.id if template is not None else None,
        name=queue_name.strip(),
        description=payload.description if payload.description is not None else template.description
        if template is not None
        else None,
        status=payload.status.strip() if payload.status is not None else template.status
        if template is not None
        else "active",
        assignment_statuses=_normalize_dispatch_filter_values(payload.assignment_statuses)
        if payload.assignment_statuses is not None
        else list(template.assignment_statuses if template is not None else []),
        execution_statuses=_normalize_dispatch_filter_values(payload.execution_statuses)
        if payload.execution_statuses is not None
        else list(template.execution_statuses if template is not None else []),
        handoff_statuses=_normalize_dispatch_filter_values(payload.handoff_statuses)
        if payload.handoff_statuses is not None
        else list(template.handoff_statuses if template is not None else []),
        source_kinds=_normalize_dispatch_filter_values(payload.source_kinds)
        if payload.source_kinds is not None
        else list(template.source_kinds if template is not None else []),
        canned_handoff_status=payload.canned_handoff_status
        if payload.canned_handoff_status is not None
        else template.canned_handoff_status
        if template is not None
        else None,
        allowed_role_codes=_normalize_role_code_values(payload.allowed_role_codes)
        if payload.allowed_role_codes is not None
        else _normalize_role_code_values(template.allowed_role_codes if template is not None else []),
        created_at=created_at,
        updated_at=created_at,
    )
    session.add(queue)
    session.commit()
    session.refresh(queue)
    return queue


def get_plan_dispatch_queue(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
) -> PlanDispatchQueue:
    queue = session.get(PlanDispatchQueue, queue_id)
    if (
        queue is None
        or queue.organization_id != organization_id
        or queue.plan_run_id != run_id
    ):
        raise NotFoundError(
            f"Dispatch queue {queue_id} was not found in run {run_id} for organization {organization_id}."
        )
    return queue


def update_plan_dispatch_queue(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
    payload: PlanDispatchQueueUpdate,
) -> PlanDispatchQueue:
    queue = get_plan_dispatch_queue(session, organization_id, run_id, queue_id)
    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data:
        next_name = str(update_data["name"]).strip()
        if next_name != queue.name:
            _ensure_unique_dispatch_queue_name(session, organization_id, run_id, next_name)
            queue.name = next_name
    if "description" in update_data:
        queue.description = update_data["description"]
    if "status" in update_data:
        queue.status = str(update_data["status"]).strip()
    if "assignment_statuses" in update_data:
        queue.assignment_statuses = _normalize_dispatch_filter_values(
            update_data["assignment_statuses"]
        )
    if "execution_statuses" in update_data:
        queue.execution_statuses = _normalize_dispatch_filter_values(
            update_data["execution_statuses"]
        )
    if "handoff_statuses" in update_data:
        queue.handoff_statuses = _normalize_dispatch_filter_values(
            update_data["handoff_statuses"]
        )
    if "source_kinds" in update_data:
        queue.source_kinds = _normalize_dispatch_filter_values(update_data["source_kinds"])
    if "canned_handoff_status" in update_data:
        queue.canned_handoff_status = update_data["canned_handoff_status"]
    if "allowed_role_codes" in update_data:
        queue.allowed_role_codes = _normalize_role_code_values(update_data["allowed_role_codes"])

    session.commit()
    session.refresh(queue)
    return queue


def delete_plan_dispatch_queue(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
) -> None:
    queue = get_plan_dispatch_queue(session, organization_id, run_id, queue_id)
    session.delete(queue)
    session.commit()


def list_dispatch_queue_assignments(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
) -> list[PlanAssignment]:
    queue = get_plan_dispatch_queue(session, organization_id, run_id, queue_id)
    assignments = list_plan_assignments(session, organization_id, run_id)
    return [
        assignment
        for assignment in assignments
        if _assignment_matches_dispatch_filters(
            assignment,
            assignment_statuses=queue.assignment_statuses,
            execution_statuses=queue.execution_statuses,
            handoff_statuses=queue.handoff_statuses,
            source_kinds=queue.source_kinds,
        )
    ]


def apply_dispatch_queue_action(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
    payload: PlanDispatchQueueApplyAction,
) -> PlanDispatchQueueApplyResult:
    queue = get_plan_dispatch_queue(session, organization_id, run_id, queue_id)
    _require_dispatch_queue_apply_permissions(
        session,
        organization_id,
        actor_name=payload.actor_name,
        actor_user_id=payload.actor_user_id,
        allowed_role_codes=queue.allowed_role_codes,
        context_label=f"dispatch queue '{queue.name}'",
    )

    matched_assignments = list_dispatch_queue_assignments(session, organization_id, run_id, queue_id)
    if not matched_assignments:
        raise ConflictError("Dispatch queue has no matching assignments in the selected run.")

    handoff_status = payload.handoff_status or queue.canned_handoff_status
    if handoff_status is None:
        raise ValidationError(
            "Dispatch queue action requires a handoff status in the request or queue definition."
        )

    handoff_result = bulk_update_plan_assignment_handoff(
        session,
        organization_id,
        run_id,
        PlanAssignmentBulkHandoffAction(
            assignment_ids=[assignment.id for assignment in matched_assignments],
            handoff_status=handoff_status,
            actor_name=payload.actor_name,
            note=payload.note,
            occurred_at=payload.occurred_at,
        ),
    )
    return PlanDispatchQueueApplyResult(
        queue_id=queue.id,
        run_id=run_id,
        source_kind="run_queue",
        matched_count=len(matched_assignments),
        matched_assignment_ids=[assignment.id for assignment in matched_assignments],
        handoff_status=handoff_result.handoff_status,
        updated_count=handoff_result.updated_count,
        updated_assignment_ids=handoff_result.updated_assignment_ids,
    )


def list_dispatch_queue_template_assignments(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    template_id: UUID,
) -> list[PlanAssignment]:
    template = get_plan_dispatch_queue_template(session, organization_id, template_id)
    assignments = list_plan_assignments(session, organization_id, run_id)
    return [
        assignment
        for assignment in assignments
        if _assignment_matches_dispatch_filters(
            assignment,
            assignment_statuses=template.assignment_statuses,
            execution_statuses=template.execution_statuses,
            handoff_statuses=template.handoff_statuses,
            source_kinds=template.source_kinds,
        )
    ]


def apply_dispatch_queue_template_action(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    template_id: UUID,
    payload: PlanDispatchQueueApplyAction,
) -> PlanDispatchQueueApplyResult:
    template = get_plan_dispatch_queue_template(session, organization_id, template_id)
    _require_dispatch_queue_apply_permissions(
        session,
        organization_id,
        actor_name=payload.actor_name,
        actor_user_id=payload.actor_user_id,
        allowed_role_codes=template.allowed_role_codes,
        context_label=f"dispatch queue template '{template.name}'",
    )

    matched_assignments = list_dispatch_queue_template_assignments(
        session,
        organization_id,
        run_id,
        template_id,
    )
    if not matched_assignments:
        raise ConflictError("Dispatch queue template has no matching assignments in the selected run.")

    handoff_status = payload.handoff_status or template.canned_handoff_status
    if handoff_status is None:
        raise ValidationError(
            "Dispatch queue action requires a handoff status in the request or queue definition."
        )

    handoff_result = bulk_update_plan_assignment_handoff(
        session,
        organization_id,
        run_id,
        PlanAssignmentBulkHandoffAction(
            assignment_ids=[assignment.id for assignment in matched_assignments],
            handoff_status=handoff_status,
            actor_name=payload.actor_name,
            note=payload.note,
            occurred_at=payload.occurred_at,
        ),
    )
    return PlanDispatchQueueApplyResult(
        queue_id=template.id,
        run_id=run_id,
        source_kind="template",
        matched_count=len(matched_assignments),
        matched_assignment_ids=[assignment.id for assignment in matched_assignments],
        handoff_status=handoff_result.handoff_status,
        updated_count=handoff_result.updated_count,
        updated_assignment_ids=handoff_result.updated_assignment_ids,
    )


def list_plan_assignment_events(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
) -> list[PlanAssignmentEvent]:
    _get_plan_assignment(session, organization_id, run_id, assignment_id)
    query = (
        select(PlanAssignmentEvent)
        .where(
            PlanAssignmentEvent.organization_id == organization_id,
            PlanAssignmentEvent.plan_run_id == run_id,
            PlanAssignmentEvent.plan_assignment_id == assignment_id,
        )
        .order_by(PlanAssignmentEvent.occurred_at.asc(), PlanAssignmentEvent.created_at.asc())
    )
    return list(session.scalars(query))


def create_plan_assignment_event(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentEventCreate,
) -> PlanAssignmentEvent:
    run = get_plan_run(session, organization_id, run_id)
    assignment = _get_plan_assignment(session, organization_id, run_id, assignment_id)
    _ensure_assignment_is_published(run, assignment)

    occurred_at = _as_utc(payload.occurred_at or datetime.now(UTC))
    latest_event = _get_latest_assignment_event(session, organization_id, run_id, assignment.id)
    if latest_event is not None and occurred_at < _as_utc(latest_event.occurred_at):
        raise ValidationError("Execution events cannot be recorded earlier than the latest event.")
    if run.published_at is not None and occurred_at < _as_utc(run.published_at):
        raise ValidationError("Execution events cannot be recorded before the run was published.")

    _apply_assignment_execution_event(
        assignment,
        payload.event_type,
        occurred_at,
        payload.note,
        payload.reason_code,
    )
    _sync_assignment_reservations_for_execution_event(assignment, occurred_at, payload.event_type)

    event = PlanAssignmentEvent(
        organization_id=organization_id,
        plan_run_id=run_id,
        plan_assignment_id=assignment.id,
        event_type=payload.event_type,
        occurred_at=occurred_at,
        actor_name=payload.actor_name,
        note=payload.note,
        payload_json={
            "execution_status": assignment.execution_status,
            "worker_id": str(assignment.worker_id),
            "work_order_id": str(assignment.work_order_id),
            "reason_code": payload.reason_code,
        },
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


def get_plan_actuals_review(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
) -> PlanActualsReviewRead:
    run = get_plan_run(session, organization_id, run_id)
    assignments = list(
        session.scalars(
            select(PlanAssignment)
            .options(
                selectinload(PlanAssignment.work_order).selectinload(WorkOrder.location),
                selectinload(PlanAssignment.work_order).selectinload(WorkOrder.service_level_policy),
                selectinload(PlanAssignment.work_order).selectinload(WorkOrder.planning_unit),
                selectinload(PlanAssignment.events),
            )
            .where(
                PlanAssignment.organization_id == organization_id,
                PlanAssignment.plan_run_id == run_id,
            )
            .order_by(PlanAssignment.scheduled_start_at.asc(), PlanAssignment.created_at.asc())
        )
    )

    items: list[PlanActualsReviewItem] = []
    delayed_start_count = 0
    overdue_completion_count = 0
    blocked_event_count = 0
    total_duration_variance_minutes = 0
    blocked_reason_counter: dict[str, int] = {}
    assignment_location_labels: dict[UUID, str] = {}
    assignment_work_type_labels: dict[UUID, str] = {}

    for assignment in assignments:
        ordered_events = sorted(
            assignment.events,
            key=lambda event: (_as_utc(event.occurred_at), _as_utc(event.created_at)),
        )
        latest_event = ordered_events[-1] if ordered_events else None
        planned_duration_minutes = _duration_minutes(
            assignment.scheduled_start_at,
            assignment.scheduled_end_at,
        )
        start_variance_minutes = _variance_minutes(
            assignment.scheduled_start_at,
            assignment.actual_start_at,
        )
        completion_variance_minutes = _variance_minutes(
            assignment.scheduled_end_at,
            assignment.actual_end_at,
        )
        if start_variance_minutes is not None and start_variance_minutes > 0:
            delayed_start_count += 1
        if completion_variance_minutes is not None and completion_variance_minutes > 0:
            overdue_completion_count += 1

        assignment_blocked_events = sum(
            1 for event in ordered_events if event.event_type == "blocked"
        )
        blocked_event_count += assignment_blocked_events
        for event in ordered_events:
            if event.event_type != "blocked":
                continue
            reason_code = str(event.payload_json.get("reason_code") or "unspecified")
            blocked_reason_counter[reason_code] = blocked_reason_counter.get(reason_code, 0) + 1

        duration_variance_minutes = None
        if planned_duration_minutes is not None and assignment.actual_duration_minutes is not None:
            duration_variance_minutes = assignment.actual_duration_minutes - planned_duration_minutes
            total_duration_variance_minutes += duration_variance_minutes

        assignment_location_labels[assignment.id] = assignment.work_order.location.name
        assignment_work_type_labels[assignment.id] = _work_type_label(assignment.work_order)

        items.append(
            PlanActualsReviewItem(
                assignment_id=assignment.id,
                work_order_id=assignment.work_order_id,
                work_order_title=assignment.work_order.title,
                worker_id=assignment.worker_id,
                worker_name=assignment.worker_name_snapshot,
                assignment_status=assignment.assignment_status,
                execution_status=assignment.execution_status,
                scheduled_start_at=assignment.scheduled_start_at,
                scheduled_end_at=assignment.scheduled_end_at,
                actual_start_at=assignment.actual_start_at,
                actual_end_at=assignment.actual_end_at,
                planned_duration_minutes=planned_duration_minutes,
                actual_duration_minutes=assignment.actual_duration_minutes,
                start_variance_minutes=start_variance_minutes,
                completion_variance_minutes=completion_variance_minutes,
                duration_variance_minutes=duration_variance_minutes,
                blocked_event_count=assignment_blocked_events,
                latest_event_type=latest_event.event_type if latest_event is not None else None,
                latest_event_at=latest_event.occurred_at if latest_event is not None else None,
                latest_event_note=latest_event.note if latest_event is not None else None,
            )
        )

    blocked_reason_counts = [
        PlanActualsReasonCount(reason_code=reason_code, count=count)
        for reason_code, count in sorted(
            blocked_reason_counter.items(),
            key=lambda item: (-item[1], item[0]),
        )
    ]

    return PlanActualsReviewRead(
        run=PlanRunReference(
            id=run.id,
            scenario_id=run.scenario_id,
            scenario_name=run.scenario_name,
            status=run.status,
            created_at=run.created_at,
        ),
        summary=PlanActualsReviewSummary(
            assignments_total=len(assignments),
            assignments_not_started=sum(
                1
                for assignment in assignments
                if assignment.execution_status == "not_started"
                and assignment.assignment_status != "cancelled"
            ),
            assignments_in_progress=sum(
                1 for assignment in assignments if assignment.execution_status == "in_progress"
            ),
            assignments_blocked=sum(
                1 for assignment in assignments if assignment.execution_status == "blocked"
            ),
            assignments_completed=sum(
                1 for assignment in assignments if assignment.execution_status == "completed"
            ),
            assignments_cancelled=sum(
                1 for assignment in assignments if assignment.assignment_status == "cancelled"
            ),
            delayed_start_count=delayed_start_count,
            overdue_completion_count=overdue_completion_count,
            blocked_event_count=blocked_event_count,
            total_duration_variance_minutes=total_duration_variance_minutes,
        ),
        items=items,
        blocked_reason_counts=blocked_reason_counts,
        worker_breakdown=_build_actuals_breakdown(items, lambda item: item.worker_name),
        location_breakdown=_build_actuals_breakdown(
            items,
            lambda item: assignment_location_labels.get(item.assignment_id, "Unknown site"),
        ),
        work_type_breakdown=_build_actuals_breakdown(
            items,
            lambda item: assignment_work_type_labels.get(item.assignment_id, "General work"),
        ),
    )


def get_operations_report(
    session: Session,
    organization_id: UUID,
    filters: OperationsReportFilters,
) -> OperationsReportRead:
    _require_organization(session, organization_id)
    _validate_planning_window(filters.window_start, filters.window_end)

    assignments = _load_operations_report_assignments(session, organization_id, filters)
    trend_granularity = _operations_trend_granularity(assignments, filters)
    pressure_window_minutes = _operations_pressure_window_minutes(assignments, filters)

    run_aggregates: dict[UUID, dict[str, object]] = {}
    worker_aggregates: dict[UUID, dict[str, object]] = {}
    location_aggregates: dict[str, dict[str, object]] = {}
    material_aggregates: dict[UUID, dict[str, object]] = {}
    equipment_aggregates: dict[UUID, dict[str, object]] = {}
    trend_aggregates: dict[datetime, dict[str, object]] = {}
    assignment_rows: list[OperationsAssignmentRow] = []

    summary_assignments_completed = 0
    summary_assignments_in_progress = 0
    summary_assignments_blocked = 0
    summary_assignments_not_started = 0
    summary_assignments_cancelled = 0
    summary_delayed_start_count = 0
    summary_overdue_completion_count = 0
    summary_blocked_event_count = 0
    summary_total_planned_minutes = 0
    summary_total_actual_minutes = 0
    summary_total_duration_variance_minutes = 0
    summary_active_worker_reservations = 0
    summary_active_equipment_reservations = 0
    summary_active_material_reservations = 0
    summary_active_reserved_material_units = 0
    summary_consumed_material_units = 0

    for assignment in assignments:
        blocked_event_count = sum(1 for event in assignment.events if event.event_type == "blocked")
        planned_duration_minutes = _duration_minutes(
            assignment.scheduled_start_at,
            assignment.scheduled_end_at,
        )
        actual_duration_minutes = assignment.actual_duration_minutes
        start_variance_minutes = _variance_minutes(
            assignment.scheduled_start_at,
            assignment.actual_start_at,
        )
        completion_variance_minutes = _variance_minutes(
            assignment.scheduled_end_at,
            assignment.actual_end_at,
        )
        duration_variance_minutes = None
        if planned_duration_minutes is not None and actual_duration_minutes is not None:
            duration_variance_minutes = actual_duration_minutes - planned_duration_minutes

        if assignment.assignment_status == "cancelled":
            summary_assignments_cancelled += 1
        elif assignment.execution_status == "completed":
            summary_assignments_completed += 1
        elif assignment.execution_status == "in_progress":
            summary_assignments_in_progress += 1
        elif assignment.execution_status == "blocked":
            summary_assignments_blocked += 1
        else:
            summary_assignments_not_started += 1

        if start_variance_minutes is not None and start_variance_minutes > 0:
            summary_delayed_start_count += 1
        if completion_variance_minutes is not None and completion_variance_minutes > 0:
            summary_overdue_completion_count += 1
        summary_blocked_event_count += blocked_event_count
        summary_total_planned_minutes += planned_duration_minutes or 0
        summary_total_actual_minutes += actual_duration_minutes or 0
        summary_total_duration_variance_minutes += duration_variance_minutes or 0

        active_worker_reservation = any(
            reservation.status == "active" for reservation in assignment.worker_reservations
        )
        active_equipment_reservations = sum(
            1 for reservation in assignment.equipment_reservations if reservation.status == "active"
        )
        active_material_reserved_quantity = sum(
            reservation.quantity
            for reservation in assignment.material_reservations
            if reservation.status == "active"
        )
        consumed_material_quantity = sum(
            reservation.quantity
            for reservation in assignment.material_reservations
            if reservation.status == "consumed"
        )

        summary_active_worker_reservations += int(active_worker_reservation)
        summary_active_equipment_reservations += active_equipment_reservations
        summary_active_material_reservations += sum(
            1 for reservation in assignment.material_reservations if reservation.status == "active"
        )
        summary_active_reserved_material_units += active_material_reserved_quantity
        summary_consumed_material_units += consumed_material_quantity

        assignment_rows.append(
            OperationsAssignmentRow(
                run_id=assignment.plan_run_id,
                scenario_name=assignment.plan_run.scenario_name,
                published_at=assignment.plan_run.published_at,
                work_order_id=assignment.work_order_id,
                work_order_title=assignment.work_order.title,
                location_id=assignment.work_order.location_id,
                location_name=assignment.work_order.location.name
                if assignment.work_order.location is not None
                else None,
                planning_unit_id=assignment.work_order.planning_unit_id,
                planning_unit_name=assignment.work_order.planning_unit.name
                if assignment.work_order.planning_unit is not None
                else None,
                worker_id=assignment.worker_id,
                worker_name=assignment.worker_name_snapshot,
                assignment_status=assignment.assignment_status,
                execution_status=assignment.execution_status,
                scheduled_start_at=assignment.scheduled_start_at,
                scheduled_end_at=assignment.scheduled_end_at,
                planned_duration_minutes=planned_duration_minutes,
                actual_start_at=assignment.actual_start_at,
                actual_end_at=assignment.actual_end_at,
                actual_duration_minutes=actual_duration_minutes,
                start_variance_minutes=start_variance_minutes,
                completion_variance_minutes=completion_variance_minutes,
                duration_variance_minutes=duration_variance_minutes,
                blocked_event_count=blocked_event_count,
                active_worker_reservation=active_worker_reservation,
                active_equipment_reservations=active_equipment_reservations,
                active_material_reserved_quantity=active_material_reserved_quantity,
                consumed_material_quantity=consumed_material_quantity,
                reserved_equipment_ids=list(assignment.reserved_equipment_ids or []),
                reserved_material_quantities=dict(assignment.reserved_material_quantities or {}),
            )
        )

        run_bucket = run_aggregates.setdefault(
            assignment.plan_run_id,
            {
                "scenario_name": assignment.plan_run.scenario_name,
                "published_at": assignment.plan_run.published_at,
                "published_by_name": assignment.plan_run.published_by_name,
                "assignments_total": 0,
                "assignments_completed": 0,
                "assignments_in_progress": 0,
                "assignments_blocked": 0,
                "assignments_not_started": 0,
                "assignments_cancelled": 0,
                "blocked_event_count": 0,
                "delayed_start_count": 0,
                "active_reservations": 0,
            },
        )
        run_bucket["assignments_total"] = int(run_bucket["assignments_total"]) + 1
        run_bucket["blocked_event_count"] = int(run_bucket["blocked_event_count"]) + blocked_event_count
        if start_variance_minutes is not None and start_variance_minutes > 0:
            run_bucket["delayed_start_count"] = int(run_bucket["delayed_start_count"]) + 1
        run_bucket["active_reservations"] = int(run_bucket["active_reservations"]) + int(
            active_worker_reservation
        ) + active_equipment_reservations + sum(
            1 for reservation in assignment.material_reservations if reservation.status == "active"
        )
        _increment_execution_status_counter(run_bucket, assignment.execution_status)

        worker_bucket = worker_aggregates.setdefault(
            assignment.worker_id,
            {
                "worker_name": assignment.worker_name_snapshot,
                "assignments_total": 0,
                "assignments_completed": 0,
                "assignments_in_progress": 0,
                "assignments_blocked": 0,
                "assignments_not_started": 0,
                "assignments_cancelled": 0,
                "blocked_event_count": 0,
                "delayed_start_count": 0,
                "planned_minutes": 0,
                "actual_minutes": 0,
                "active_reservations": 0,
            },
        )
        worker_bucket["assignments_total"] = int(worker_bucket["assignments_total"]) + 1
        worker_bucket["blocked_event_count"] = int(worker_bucket["blocked_event_count"]) + blocked_event_count
        if start_variance_minutes is not None and start_variance_minutes > 0:
            worker_bucket["delayed_start_count"] = int(worker_bucket["delayed_start_count"]) + 1
        worker_bucket["planned_minutes"] = int(worker_bucket["planned_minutes"]) + (planned_duration_minutes or 0)
        worker_bucket["actual_minutes"] = int(worker_bucket["actual_minutes"]) + (actual_duration_minutes or 0)
        worker_bucket["active_reservations"] = int(worker_bucket["active_reservations"]) + int(
            active_worker_reservation
        )
        _increment_execution_status_counter(worker_bucket, assignment.execution_status)

        location_key = str(assignment.work_order.location_id) if assignment.work_order.location_id else "unknown"
        location_bucket = location_aggregates.setdefault(
            location_key,
            {
                "location_id": assignment.work_order.location_id,
                "location_name": assignment.work_order.location.name
                if assignment.work_order.location is not None
                else "Unknown site",
                "assignments_total": 0,
                "assignments_completed": 0,
                "assignments_in_progress": 0,
                "assignments_blocked": 0,
                "assignments_not_started": 0,
                "assignments_cancelled": 0,
                "blocked_event_count": 0,
                "delayed_start_count": 0,
                "planned_minutes": 0,
                "actual_minutes": 0,
                "active_reservations": 0,
            },
        )
        location_bucket["assignments_total"] = int(location_bucket["assignments_total"]) + 1
        location_bucket["blocked_event_count"] = int(location_bucket["blocked_event_count"]) + blocked_event_count
        if start_variance_minutes is not None and start_variance_minutes > 0:
            location_bucket["delayed_start_count"] = int(location_bucket["delayed_start_count"]) + 1
        location_bucket["planned_minutes"] = int(location_bucket["planned_minutes"]) + (planned_duration_minutes or 0)
        location_bucket["actual_minutes"] = int(location_bucket["actual_minutes"]) + (actual_duration_minutes or 0)
        location_bucket["active_reservations"] = int(location_bucket["active_reservations"]) + int(
            active_worker_reservation
        ) + active_equipment_reservations + sum(
            1 for reservation in assignment.material_reservations if reservation.status == "active"
        )
        _increment_execution_status_counter(location_bucket, assignment.execution_status)

        trend_anchor = _operations_reporting_anchor(assignment)
        if trend_anchor is not None:
            bucket_start = _operations_trend_bucket_start(trend_anchor, trend_granularity)
            bucket_end = _operations_trend_bucket_end(bucket_start, trend_granularity)
            trend_bucket = trend_aggregates.setdefault(
                bucket_start,
                {
                    "bucket_start": bucket_start,
                    "bucket_end": bucket_end,
                    "bucket_label": _operations_trend_bucket_label(
                        bucket_start,
                        bucket_end,
                        trend_granularity,
                    ),
                    "assignments_total": 0,
                    "assignments_completed": 0,
                    "assignments_in_progress": 0,
                    "assignments_blocked": 0,
                    "assignments_not_started": 0,
                    "assignments_cancelled": 0,
                    "blocked_event_count": 0,
                    "total_planned_minutes": 0,
                    "total_actual_minutes": 0,
                    "total_duration_variance_minutes": 0,
                    "active_worker_reservations": 0,
                    "active_equipment_reservations": 0,
                    "active_material_reserved_units": 0,
                    "consumed_material_units": 0,
                    "equipment_reserved_minutes": 0,
                },
            )
            trend_bucket["assignments_total"] = int(trend_bucket["assignments_total"]) + 1
            trend_bucket["blocked_event_count"] = int(trend_bucket["blocked_event_count"]) + blocked_event_count
            trend_bucket["total_planned_minutes"] = int(trend_bucket["total_planned_minutes"]) + (
                planned_duration_minutes or 0
            )
            trend_bucket["total_actual_minutes"] = int(trend_bucket["total_actual_minutes"]) + (
                actual_duration_minutes or 0
            )
            trend_bucket["total_duration_variance_minutes"] = int(
                trend_bucket["total_duration_variance_minutes"]
            ) + (duration_variance_minutes or 0)
            trend_bucket["active_worker_reservations"] = int(
                trend_bucket["active_worker_reservations"]
            ) + int(active_worker_reservation)
            trend_bucket["active_equipment_reservations"] = int(
                trend_bucket["active_equipment_reservations"]
            ) + active_equipment_reservations
            trend_bucket["active_material_reserved_units"] = int(
                trend_bucket["active_material_reserved_units"]
            ) + active_material_reserved_quantity
            trend_bucket["consumed_material_units"] = int(
                trend_bucket["consumed_material_units"]
            ) + consumed_material_quantity
            trend_bucket["equipment_reserved_minutes"] = int(
                trend_bucket["equipment_reserved_minutes"]
            ) + sum(
                _bounded_duration_minutes(
                    reservation.reserved_start_at,
                    reservation.reserved_end_at,
                    bucket_start,
                    bucket_end,
                )
                for reservation in assignment.equipment_reservations
            )
            _increment_execution_status_counter(trend_bucket, assignment.execution_status)

        for reservation in assignment.material_reservations:
            inventory_position = reservation.inventory_position
            material = reservation.material
            location = inventory_position.location
            material_bucket = material_aggregates.setdefault(
                inventory_position.id,
                {
                    "material_id": material.id,
                    "material_code": material.sku,
                    "material_name": material.name,
                    "location_id": inventory_position.location_id,
                    "location_name": location.name,
                    "assignments_total": 0,
                    "on_hand_quantity": inventory_position.on_hand_quantity,
                    "reserved_quantity": inventory_position.reserved_quantity,
                    "available_quantity": max(
                        0,
                        inventory_position.on_hand_quantity - inventory_position.reserved_quantity,
                    ),
                    "active_reserved_quantity": 0,
                    "consumed_quantity": 0,
                },
            )
            material_bucket["assignments_total"] = int(material_bucket["assignments_total"]) + 1
            if reservation.status == "active":
                material_bucket["active_reserved_quantity"] = int(
                    material_bucket["active_reserved_quantity"]
                ) + reservation.quantity
            if reservation.status == "consumed":
                material_bucket["consumed_quantity"] = int(material_bucket["consumed_quantity"]) + reservation.quantity

        for reservation in assignment.equipment_reservations:
            equipment = reservation.equipment
            reserved_minutes = _bounded_duration_minutes(
                reservation.reserved_start_at,
                reservation.reserved_end_at,
                filters.window_start,
                filters.window_end,
            )
            equipment_bucket = equipment_aggregates.setdefault(
                equipment.id,
                {
                    "equipment_id": equipment.id,
                    "equipment_code": equipment.equipment_code,
                    "equipment_type_code": equipment.equipment_type.code,
                    "equipment_type_name": equipment.equipment_type.name,
                    "location_id": equipment.location_id,
                    "location_name": equipment.location.name,
                    "assignments_total": 0,
                    "active_reservations": 0,
                    "reserved_minutes": 0,
                },
            )
            equipment_bucket["assignments_total"] = int(equipment_bucket["assignments_total"]) + 1
            equipment_bucket["reserved_minutes"] = int(equipment_bucket["reserved_minutes"]) + reserved_minutes
            if reservation.status == "active":
                equipment_bucket["active_reservations"] = int(
                    equipment_bucket["active_reservations"]
                ) + 1

    assignment_rows.sort(
        key=lambda item: (
            item.published_at or datetime.min.replace(tzinfo=UTC),
            item.scheduled_start_at or datetime.min.replace(tzinfo=UTC),
            item.work_order_title.lower(),
        ),
        reverse=True,
    )

    published_runs = [
        OperationsPublishedRunItem(
            run_id=run_id,
            scenario_name=str(values["scenario_name"]),
            published_at=values["published_at"],  # type: ignore[arg-type]
            published_by_name=values["published_by_name"],  # type: ignore[arg-type]
            assignments_total=int(values["assignments_total"]),
            assignments_completed=int(values["assignments_completed"]),
            assignments_in_progress=int(values["assignments_in_progress"]),
            assignments_blocked=int(values["assignments_blocked"]),
            assignments_not_started=int(values["assignments_not_started"]),
            assignments_cancelled=int(values["assignments_cancelled"]),
            blocked_event_count=int(values["blocked_event_count"]),
            active_reservations=int(values["active_reservations"]),
        )
        for run_id, values in sorted(
            run_aggregates.items(),
            key=lambda item: (
                item[1]["published_at"] or datetime.min.replace(tzinfo=UTC),
                str(item[1]["scenario_name"]).lower(),
            ),
            reverse=True,
        )
    ]

    worker_breakdown = [
        OperationsWorkerBreakdownItem(
            worker_id=worker_id,
            worker_name=str(values["worker_name"]),
            assignments_total=int(values["assignments_total"]),
            assignments_completed=int(values["assignments_completed"]),
            assignments_in_progress=int(values["assignments_in_progress"]),
            assignments_blocked=int(values["assignments_blocked"]),
            assignments_not_started=int(values["assignments_not_started"]),
            assignments_cancelled=int(values["assignments_cancelled"]),
            blocked_event_count=int(values["blocked_event_count"]),
            planned_minutes=int(values["planned_minutes"]),
            actual_minutes=int(values["actual_minutes"]),
            active_reservations=int(values["active_reservations"]),
        )
        for worker_id, values in sorted(
            worker_aggregates.items(),
            key=lambda item: (
                -int(item[1]["assignments_total"]),
                str(item[1]["worker_name"]).lower(),
            ),
        )
    ]

    location_breakdown = [
        OperationsLocationBreakdownItem(
            location_id=values["location_id"],  # type: ignore[arg-type]
            location_name=str(values["location_name"]),
            assignments_total=int(values["assignments_total"]),
            assignments_completed=int(values["assignments_completed"]),
            assignments_in_progress=int(values["assignments_in_progress"]),
            assignments_blocked=int(values["assignments_blocked"]),
            assignments_not_started=int(values["assignments_not_started"]),
            assignments_cancelled=int(values["assignments_cancelled"]),
            blocked_event_count=int(values["blocked_event_count"]),
            planned_minutes=int(values["planned_minutes"]),
            actual_minutes=int(values["actual_minutes"]),
            active_reservations=int(values["active_reservations"]),
        )
        for _, values in sorted(
            location_aggregates.items(),
            key=lambda item: (
                -int(item[1]["assignments_total"]),
                str(item[1]["location_name"]).lower(),
            ),
        )
    ]

    material_breakdown = [
        OperationsMaterialBreakdownItem(
            material_id=values["material_id"],  # type: ignore[arg-type]
            material_code=str(values["material_code"]),
            material_name=str(values["material_name"]),
            location_id=values["location_id"],  # type: ignore[arg-type]
            location_name=str(values["location_name"]),
            assignments_total=int(values["assignments_total"]),
            on_hand_quantity=int(values["on_hand_quantity"]),
            reserved_quantity=int(values["reserved_quantity"]),
            available_quantity=int(values["available_quantity"]),
            active_reserved_quantity=int(values["active_reserved_quantity"]),
            consumed_quantity=int(values["consumed_quantity"]),
        )
        for _, values in sorted(
            material_aggregates.items(),
            key=lambda item: (
                -int(item[1]["active_reserved_quantity"]) - int(item[1]["consumed_quantity"]),
                str(item[1]["material_name"]).lower(),
            ),
        )
    ]

    equipment_breakdown = [
        OperationsEquipmentBreakdownItem(
            equipment_id=values["equipment_id"],  # type: ignore[arg-type]
            equipment_code=str(values["equipment_code"]),
            equipment_type_code=str(values["equipment_type_code"]),
            equipment_type_name=str(values["equipment_type_name"]),
            location_id=values["location_id"],  # type: ignore[arg-type]
            location_name=str(values["location_name"]),
            assignments_total=int(values["assignments_total"]),
            active_reservations=int(values["active_reservations"]),
            reserved_minutes=int(values["reserved_minutes"]),
        )
        for _, values in sorted(
            equipment_aggregates.items(),
            key=lambda item: (
                -int(item[1]["active_reservations"]),
                -int(item[1]["reserved_minutes"]),
                str(item[1]["equipment_code"]).lower(),
            ),
        )
    ]

    bottlenecks = _build_operations_bottlenecks(
        worker_aggregates=worker_aggregates,
        location_aggregates=location_aggregates,
        material_aggregates=material_aggregates,
        equipment_aggregates=equipment_aggregates,
        pressure_window_minutes=pressure_window_minutes,
    )
    trends = [
        OperationsTrendPoint(
            bucket_start=values["bucket_start"],  # type: ignore[arg-type]
            bucket_end=values["bucket_end"],  # type: ignore[arg-type]
            bucket_label=str(values["bucket_label"]),
            assignments_total=int(values["assignments_total"]),
            assignments_completed=int(values["assignments_completed"]),
            assignments_in_progress=int(values["assignments_in_progress"]),
            assignments_blocked=int(values["assignments_blocked"]),
            assignments_not_started=int(values["assignments_not_started"]),
            assignments_cancelled=int(values["assignments_cancelled"]),
            blocked_event_count=int(values["blocked_event_count"]),
            total_planned_minutes=int(values["total_planned_minutes"]),
            total_actual_minutes=int(values["total_actual_minutes"]),
            total_duration_variance_minutes=int(values["total_duration_variance_minutes"]),
            active_worker_reservations=int(values["active_worker_reservations"]),
            active_equipment_reservations=int(values["active_equipment_reservations"]),
            active_material_reserved_units=int(values["active_material_reserved_units"]),
            consumed_material_units=int(values["consumed_material_units"]),
            equipment_reserved_minutes=int(values["equipment_reserved_minutes"]),
        )
        for _, values in sorted(trend_aggregates.items(), key=lambda item: item[0])
    ]

    return OperationsReportRead(
        filters=filters,
        summary=OperationsReportSummary(
            published_runs_count=len(run_aggregates),
            assignments_total=len(assignments),
            assignments_completed=summary_assignments_completed,
            assignments_in_progress=summary_assignments_in_progress,
            assignments_blocked=summary_assignments_blocked,
            assignments_not_started=summary_assignments_not_started,
            assignments_cancelled=summary_assignments_cancelled,
            delayed_start_count=summary_delayed_start_count,
            overdue_completion_count=summary_overdue_completion_count,
            blocked_event_count=summary_blocked_event_count,
            total_planned_minutes=summary_total_planned_minutes,
            total_actual_minutes=summary_total_actual_minutes,
            total_duration_variance_minutes=summary_total_duration_variance_minutes,
            active_worker_reservations=summary_active_worker_reservations,
            active_equipment_reservations=summary_active_equipment_reservations,
            active_material_reservations=summary_active_material_reservations,
            active_reserved_material_units=summary_active_reserved_material_units,
            consumed_material_units=summary_consumed_material_units,
        ),
        published_runs=published_runs,
        worker_breakdown=worker_breakdown,
        location_breakdown=location_breakdown,
        material_breakdown=material_breakdown,
        equipment_breakdown=equipment_breakdown,
        bottlenecks=bottlenecks,
        trend_granularity=trend_granularity,
        trends=trends,
        assignment_rows=assignment_rows,
    )


def export_operations_report_csv(
    session: Session,
    organization_id: UUID,
    filters: OperationsReportFilters,
) -> str:
    report = get_operations_report(session, organization_id, filters)
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "run_id",
            "scenario_name",
            "published_at",
            "work_order_id",
            "work_order_title",
            "location_name",
            "planning_unit_name",
            "worker_name",
            "assignment_status",
            "execution_status",
            "scheduled_start_at",
            "scheduled_end_at",
            "planned_duration_minutes",
            "actual_start_at",
            "actual_end_at",
            "actual_duration_minutes",
            "start_variance_minutes",
            "completion_variance_minutes",
            "duration_variance_minutes",
            "blocked_event_count",
            "active_worker_reservation",
            "active_equipment_reservations",
            "active_material_reserved_quantity",
            "consumed_material_quantity",
            "reserved_equipment_ids",
            "reserved_material_quantities",
        ]
    )
    for row in report.assignment_rows:
        writer.writerow(
            [
                str(row.run_id),
                row.scenario_name,
                row.published_at.isoformat() if row.published_at is not None else "",
                str(row.work_order_id),
                row.work_order_title,
                row.location_name or "",
                row.planning_unit_name or "",
                row.worker_name,
                row.assignment_status,
                row.execution_status,
                row.scheduled_start_at.isoformat() if row.scheduled_start_at is not None else "",
                row.scheduled_end_at.isoformat() if row.scheduled_end_at is not None else "",
                row.planned_duration_minutes or "",
                row.actual_start_at.isoformat() if row.actual_start_at is not None else "",
                row.actual_end_at.isoformat() if row.actual_end_at is not None else "",
                row.actual_duration_minutes or "",
                row.start_variance_minutes or "",
                row.completion_variance_minutes or "",
                row.duration_variance_minutes or "",
                row.blocked_event_count,
                "yes" if row.active_worker_reservation else "no",
                row.active_equipment_reservations,
                row.active_material_reserved_quantity,
                row.consumed_material_quantity,
                "|".join(row.reserved_equipment_ids),
                "; ".join(
                    f"{material_code}:{quantity}"
                    for material_code, quantity in sorted(row.reserved_material_quantities.items())
                ),
            ]
        )
    return buffer.getvalue()


def override_plan_assignment(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentOverrideUpdate,
) -> PlanAssignment:
    run = get_plan_run(session, organization_id, run_id)
    _ensure_run_can_be_edited(run)
    assignment = _get_plan_assignment(session, organization_id, run_id, assignment_id)
    lead_worker = _get_worker(session, organization_id, payload.worker_id)
    work_order = _get_work_order(session, organization_id, assignment.work_order_id)
    start_at, end_at = _resolve_assignment_window(
        work_order,
        payload.scheduled_start_at or assignment.scheduled_start_at,
        payload.scheduled_end_at or assignment.scheduled_end_at,
    )
    crew_workers = _resolve_assignment_override_crew(
        session,
        organization_id,
        lead_worker,
        payload.crew_worker_ids,
        expected_crew_size=max(1, assignment.crew_size_required or 1),
        work_order_title=work_order.title,
    )

    (
        crew_worker_ids,
        crew_worker_names,
        matched_skill_codes,
        matched_certification_codes,
        score,
        reserved_equipment_ids,
        estimated_travel_minutes,
    ) = _validate_assignment_dispatch_edit(
        session,
        organization_id,
        run,
        crew_workers,
        lead_worker,
        work_order,
        start_at,
        end_at,
        assignment_id=assignment.id,
    )

    assignment.worker_id = lead_worker.id
    assignment.worker_name_snapshot = lead_worker.display_name
    assignment.crew_worker_ids = crew_worker_ids
    assignment.crew_worker_names = crew_worker_names
    assignment.crew_size_required = len(crew_worker_ids)
    assignment.score = score
    assignment.matched_skill_codes = matched_skill_codes
    assignment.matched_certification_codes = matched_certification_codes
    assignment.scheduled_start_at = start_at
    assignment.scheduled_end_at = end_at
    assignment.source_kind = "manual_override"
    assignment.reserved_equipment_ids = reserved_equipment_ids
    assignment.estimated_travel_minutes = estimated_travel_minutes
    assignment.estimated_overtime_minutes = 0
    assignment.override_reason = payload.override_reason
    assignment.override_note = payload.override_note
    assignment.override_actor_name = payload.actor_name
    assignment.overridden_at = datetime.now(UTC)

    _reset_run_review_state(run)
    _refresh_run_summary_from_assignments(run)
    session.commit()
    session.refresh(assignment)
    return assignment


def reassign_published_assignment(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentReassignmentAction,
) -> PlanAssignment:
    run = get_plan_run(session, organization_id, run_id)
    assignment = _get_plan_assignment(session, organization_id, run_id, assignment_id)
    _ensure_assignment_can_be_reassigned(run, assignment)

    lead_worker = _get_worker(session, organization_id, payload.worker_id)
    work_order = _get_work_order(session, organization_id, assignment.work_order_id)
    start_at, end_at = _resolve_assignment_window(
        work_order,
        payload.scheduled_start_at or assignment.scheduled_start_at,
        payload.scheduled_end_at or assignment.scheduled_end_at,
    )
    crew_workers = _resolve_assignment_override_crew(
        session,
        organization_id,
        lead_worker,
        payload.crew_worker_ids,
        expected_crew_size=max(1, assignment.crew_size_required or 1),
        work_order_title=work_order.title,
    )

    (
        crew_worker_ids,
        crew_worker_names,
        matched_skill_codes,
        matched_certification_codes,
        score,
        reserved_equipment_ids,
        estimated_travel_minutes,
    ) = _validate_assignment_dispatch_edit(
        session,
        organization_id,
        run,
        crew_workers,
        lead_worker,
        work_order,
        start_at,
        end_at,
        assignment_id=assignment.id,
    )

    occurred_at = _as_utc(payload.occurred_at or datetime.now(UTC))
    previous_worker_id = assignment.worker_id
    previous_worker_name = assignment.worker_name_snapshot
    previous_crew_worker_ids = list(assignment.crew_worker_ids or [str(assignment.worker_id)])
    previous_crew_worker_names = list(
        assignment.crew_worker_names or [assignment.worker_name_snapshot]
    )
    previous_start_at = assignment.scheduled_start_at
    previous_end_at = assignment.scheduled_end_at
    previous_equipment_ids = list(assignment.reserved_equipment_ids or [])
    previous_handoff_status = assignment.dispatch_handoff_status

    _release_active_assignment_reservations(
        assignment,
        occurred_at,
        release_materials=False,
    )

    assignment.worker_id = lead_worker.id
    assignment.worker_name_snapshot = lead_worker.display_name
    assignment.crew_worker_ids = crew_worker_ids
    assignment.crew_worker_names = crew_worker_names
    assignment.crew_size_required = len(crew_worker_ids)
    assignment.score = score
    assignment.matched_skill_codes = matched_skill_codes
    assignment.matched_certification_codes = matched_certification_codes
    assignment.scheduled_start_at = start_at
    assignment.scheduled_end_at = end_at
    assignment.source_kind = "published_reassignment"
    assignment.reserved_equipment_ids = reserved_equipment_ids
    assignment.estimated_travel_minutes = estimated_travel_minutes
    assignment.estimated_overtime_minutes = 0
    assignment.override_reason = payload.reason
    assignment.override_note = payload.note
    assignment.override_actor_name = payload.actor_name
    assignment.overridden_at = occurred_at
    assignment.execution_status = "not_started"
    assignment.actual_start_at = None
    assignment.actual_end_at = None
    assignment.actual_duration_minutes = None
    assignment.latest_execution_event_at = occurred_at
    assignment.dispatch_handoff_status = "pending"
    assignment.dispatch_handoff_note = None
    assignment.dispatch_handoff_actor_name = None
    assignment.dispatch_handoff_at = None

    _create_worker_reservations_for_assignment(
        session,
        organization_id,
        run,
        assignment,
        start_at,
        end_at,
    )
    _create_equipment_reservations_for_assignment(
        session,
        organization_id,
        run,
        assignment,
        start_at,
        end_at,
    )
    _append_assignment_audit_event(
        session,
        organization_id,
        run_id,
        assignment,
        event_type="reassigned",
        occurred_at=occurred_at,
        actor_name=payload.actor_name,
        note=payload.note,
        payload_json={
            "reason": payload.reason,
            "previous_worker_id": str(previous_worker_id),
            "previous_worker_name": previous_worker_name,
            "previous_crew_worker_ids": previous_crew_worker_ids,
            "previous_crew_worker_names": previous_crew_worker_names,
            "new_worker_id": str(lead_worker.id),
            "new_worker_name": lead_worker.display_name,
            "new_crew_worker_ids": crew_worker_ids,
            "new_crew_worker_names": crew_worker_names,
            "previous_scheduled_start_at": previous_start_at.isoformat()
            if previous_start_at is not None
            else None,
            "previous_scheduled_end_at": previous_end_at.isoformat()
            if previous_end_at is not None
            else None,
            "new_scheduled_start_at": start_at.isoformat() if start_at is not None else None,
            "new_scheduled_end_at": end_at.isoformat() if end_at is not None else None,
            "previous_reserved_equipment_ids": previous_equipment_ids,
            "new_reserved_equipment_ids": reserved_equipment_ids,
            "previous_handoff_status": previous_handoff_status,
            "new_handoff_status": assignment.dispatch_handoff_status,
            "execution_status": assignment.execution_status,
            "worker_id": str(lead_worker.id),
            "work_order_id": str(assignment.work_order_id),
        },
    )

    _refresh_run_summary_from_assignments(run)
    session.commit()
    session.refresh(assignment)
    return assignment


def cancel_published_assignment(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentCancellationAction,
) -> PlanAssignment:
    run = get_plan_run(session, organization_id, run_id)
    assignment = _get_plan_assignment(session, organization_id, run_id, assignment_id)
    _ensure_assignment_can_be_cancelled(run, assignment)

    occurred_at = _as_utc(payload.occurred_at or datetime.now(UTC))
    _release_active_assignment_reservations(
        assignment,
        occurred_at,
        release_materials=True,
    )

    assignment.assignment_status = "cancelled"
    assignment.execution_status = "cancelled"
    assignment.source_kind = "published_cancellation"
    assignment.override_reason = payload.reason
    assignment.override_note = payload.note
    assignment.override_actor_name = payload.actor_name
    assignment.overridden_at = occurred_at
    assignment.latest_execution_event_at = occurred_at

    _append_assignment_audit_event(
        session,
        organization_id,
        run_id,
        assignment,
        event_type="cancelled",
        occurred_at=occurred_at,
        actor_name=payload.actor_name,
        note=payload.note,
        payload_json={
            "reason": payload.reason,
            "execution_status": assignment.execution_status,
            "worker_id": str(assignment.worker_id),
            "work_order_id": str(assignment.work_order_id),
        },
    )

    _refresh_run_summary_from_assignments(run)
    session.commit()
    session.refresh(assignment)
    return assignment


def bulk_update_plan_assignment_handoff(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    payload: PlanAssignmentBulkHandoffAction,
) -> PlanAssignmentBulkHandoffResult:
    run = get_plan_run(session, organization_id, run_id)
    if run.publication_status != "published":
        raise ConflictError("Dispatch handoff controls are only available after publication.")

    assignment_ids = list(dict.fromkeys(payload.assignment_ids))
    assignments = list(
        session.scalars(
            select(PlanAssignment).where(
                PlanAssignment.organization_id == organization_id,
                PlanAssignment.plan_run_id == run_id,
                PlanAssignment.id.in_(assignment_ids),
            )
        )
    )
    assignments_by_id = {assignment.id: assignment for assignment in assignments}
    missing_assignment_ids = [
        assignment_id for assignment_id in assignment_ids if assignment_id not in assignments_by_id
    ]
    if missing_assignment_ids:
        raise NotFoundError(
            "Assignments were not found for this run: "
            + ", ".join(str(assignment_id) for assignment_id in missing_assignment_ids)
        )

    occurred_at = _as_utc(payload.occurred_at or datetime.now(UTC))
    updated_assignment_ids: list[UUID] = []
    for assignment_id in assignment_ids:
        assignment = assignments_by_id[assignment_id]
        if assignment.assignment_status == "cancelled":
            raise ConflictError(
                f"Cancelled assignment {assignment.id} cannot receive dispatch handoff updates."
            )

        previous_handoff_status = assignment.dispatch_handoff_status
        assignment.dispatch_handoff_status = payload.handoff_status
        assignment.dispatch_handoff_note = payload.note
        assignment.dispatch_handoff_actor_name = payload.actor_name
        assignment.dispatch_handoff_at = occurred_at

        _append_assignment_audit_event(
            session,
            organization_id,
            run_id,
            assignment,
            event_type="handoff_updated",
            occurred_at=occurred_at,
            actor_name=payload.actor_name,
            note=payload.note,
            payload_json={
                "previous_handoff_status": previous_handoff_status,
                "new_handoff_status": payload.handoff_status,
                "execution_status": assignment.execution_status,
                "worker_id": str(assignment.worker_id),
                "work_order_id": str(assignment.work_order_id),
            },
        )
        updated_assignment_ids.append(assignment.id)

    session.commit()
    return PlanAssignmentBulkHandoffResult(
        run_id=run.id,
        handoff_status=payload.handoff_status,
        occurred_at=occurred_at,
        updated_count=len(updated_assignment_ids),
        updated_assignment_ids=updated_assignment_ids,
    )


def approve_plan_run(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    payload: PlanRunApprovalAction,
) -> PlanRun:
    run = get_plan_run(session, organization_id, run_id)
    if run.status != "completed":
        raise ConflictError("Only completed plan runs can be approved.")
    if run.publication_status == "published":
        raise ConflictError("Published plan runs cannot be re-approved.")

    run.review_status = "approved"
    run.approval_note = payload.note
    run.approved_at = datetime.now(UTC)
    run.approved_by_name = payload.actor_name
    session.commit()
    session.refresh(run)
    return run


def publish_plan_run(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    payload: PlanRunPublishAction,
) -> PlanRun:
    run = get_plan_run(session, organization_id, run_id)
    if run.review_status != "approved":
        raise ConflictError("Plan runs must be approved before they can be published.")
    if run.publication_status == "published":
        raise ConflictError("Plan run is already published.")

    published_at = _as_utc(payload.published_at or datetime.now(UTC))
    assignments = _load_plan_assignments_for_reservation_sync(session, organization_id, run_id)
    _ensure_run_has_no_persisted_reservations(session, run.id)

    for assignment in assignments:
        _publish_assignment_reservations(
            session,
            organization_id,
            run,
            assignment,
            published_at,
        )

    run.publication_status = "published"
    run.published_at = published_at
    run.published_by_name = payload.actor_name
    for assignment in assignments:
        assignment.assignment_status = "published"
        assignment.execution_status = "not_started"
    session.commit()
    session.refresh(run)
    return run


def save_plan_run_as_scenario(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
) -> PlanScenario:
    run = get_plan_run(session, organization_id, run_id)
    clone_name = _generate_unique_copy_name(session, organization_id, run.scenario_name)
    planning_request = OrganizationPlanningRequest.model_validate(run.planning_request).model_copy(
        update={"scenario_name": clone_name}
    )

    description: str | None = None
    notes: str | None = None
    labels: list[str] = []
    if run.scenario_id is not None:
        origin_scenario = get_plan_scenario(session, organization_id, run.scenario_id)
        description = origin_scenario.description
        notes = origin_scenario.notes
        labels = list(origin_scenario.labels or [])

    scenario = PlanScenario(
        organization_id=organization_id,
        base_scenario_id=run.scenario_id,
        source_run_id=run.id,
        name=clone_name,
        description=description,
        notes=notes,
        scenario_type="from_run",
        status="active",
        labels=labels,
        planning_request=planning_request.model_dump(mode="json"),
    )
    session.add(scenario)
    session.commit()
    session.refresh(scenario)
    return scenario


def compare_plan_runs(
    session: Session,
    organization_id: UUID,
    baseline_run_id: UUID,
    candidate_run_id: UUID,
) -> PlanRunComparisonRead:
    baseline_run = get_plan_run(session, organization_id, baseline_run_id)
    candidate_run = get_plan_run(session, organization_id, candidate_run_id)

    baseline_summary = PlanRunSummary.model_validate(baseline_run.summary)
    candidate_summary = PlanRunSummary.model_validate(candidate_run.summary)

    work_order_ids = {
        assignment.work_order_id for assignment in baseline_summary.assignments
    } | {
        assignment.work_order_id for assignment in candidate_summary.assignments
    } | {
        item.work_order_id for item in baseline_summary.unassigned
    } | {
        item.work_order_id for item in candidate_summary.unassigned
    }
    work_order_titles = _load_work_order_titles(session, organization_id, work_order_ids)

    assignment_changes = _assignment_changes(
        baseline_summary,
        candidate_summary,
        work_order_titles,
    )
    unassigned_changes = _unassigned_changes(
        baseline_summary,
        candidate_summary,
        work_order_titles,
    )
    issue_changes = _issue_changes(baseline_summary, candidate_summary)

    newly_assigned_work_orders = sum(
        1 for change in assignment_changes if change.change_type == "added"
    )
    newly_unassigned_work_orders = sum(
        1 for change in unassigned_changes if change.change_type == "added"
    )

    return PlanRunComparisonRead(
        baseline_run=PlanRunReference(
            id=baseline_run.id,
            scenario_id=baseline_run.scenario_id,
            scenario_name=baseline_run.scenario_name,
            status=baseline_run.status,
            created_at=baseline_run.created_at,
        ),
        candidate_run=PlanRunReference(
            id=candidate_run.id,
            scenario_id=candidate_run.scenario_id,
            scenario_name=candidate_run.scenario_name,
            status=candidate_run.status,
            created_at=candidate_run.created_at,
        ),
        summary=PlanRunComparisonSummary(
            assignments_before=len(baseline_summary.assignments),
            assignments_after=len(candidate_summary.assignments),
            unassigned_before=len(baseline_summary.unassigned),
            unassigned_after=len(candidate_summary.unassigned),
            issues_before=len(baseline_summary.issues),
            issues_after=len(candidate_summary.issues),
            assignment_changes=len(assignment_changes),
            unassigned_changes=len(unassigned_changes),
            issue_changes=len(issue_changes),
            newly_assigned_work_orders=newly_assigned_work_orders,
            newly_unassigned_work_orders=newly_unassigned_work_orders,
        ),
        assignment_changes=assignment_changes,
        unassigned_changes=unassigned_changes,
        issue_changes=issue_changes,
    )


def create_plan_run(
    session: Session,
    organization_id: UUID,
    payload: PlanRunCreate,
) -> PlanRun:
    scenario: PlanScenario | None = None
    if payload.scenario_id is not None:
        scenario = get_plan_scenario(session, organization_id, payload.scenario_id)

    planning_request, projection_issues = build_organization_planning_request(
        session,
        organization_id,
        payload,
    )
    persisted_planning_request = payload.model_copy(
        update={
            "window_start": planning_request.window_start,
            "window_end": planning_request.window_end,
        }
    )
    summary = generate_stub_plan(planning_request)
    persisted_summary = summary.model_copy(update={"issues": [*projection_issues, *summary.issues]})

    run = PlanRun(
        organization_id=organization_id,
        scenario_id=scenario.id if scenario is not None else None,
        scenario_name=scenario.name if scenario is not None else payload.scenario_name,
        run_kind="draft",
        status=persisted_summary.status,
        review_status="draft",
        publication_status="draft",
        planning_request=persisted_planning_request.model_dump(
            exclude={"scenario_id"},
            mode="json",
        ),
        summary=persisted_summary.model_dump(mode="json"),
    )
    session.add(run)
    session.flush()
    _persist_plan_assignments(session, run, persisted_summary.assignments)
    session.commit()
    session.refresh(run)
    return run


def _persist_plan_assignments(
    session: Session,
    run: PlanRun,
    assignments: list[CandidateAssignment],
) -> None:
    for assignment in assignments:
        session.add(
            PlanAssignment(
                organization_id=run.organization_id,
                plan_run_id=run.id,
                work_order_id=UUID(assignment.work_order_id),
                worker_id=UUID(assignment.worker_id),
                worker_name_snapshot=assignment.worker_name,
                crew_worker_ids=list(assignment.crew_worker_ids or [assignment.worker_id]),
                crew_worker_names=list(assignment.crew_worker_names or [assignment.worker_name]),
                crew_size_required=max(1, assignment.crew_size_required),
                assignment_status="draft",
                source_kind="planner",
                score=assignment.score,
                matched_skill_codes=assignment.matched_skill_codes,
                matched_certification_codes=assignment.matched_certification_codes,
                reserved_material_quantities=assignment.reserved_material_quantities,
                reserved_equipment_ids=assignment.reserved_equipment_ids,
                scheduled_start_at=assignment.scheduled_start_at,
                scheduled_end_at=assignment.scheduled_end_at,
                estimated_travel_minutes=assignment.estimated_travel_minutes,
                estimated_overtime_minutes=assignment.estimated_overtime_minutes,
            )
        )


def _get_plan_assignment(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
) -> PlanAssignment:
    assignment = session.get(PlanAssignment, assignment_id)
    if (
        assignment is None
        or assignment.organization_id != organization_id
        or assignment.plan_run_id != run_id
    ):
        raise NotFoundError(
            f"Plan assignment {assignment_id} was not found in run {run_id} for organization {organization_id}."
        )
    return assignment


def _get_latest_assignment_event(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
) -> PlanAssignmentEvent | None:
    query = (
        select(PlanAssignmentEvent)
        .where(
            PlanAssignmentEvent.organization_id == organization_id,
            PlanAssignmentEvent.plan_run_id == run_id,
            PlanAssignmentEvent.plan_assignment_id == assignment_id,
        )
        .order_by(desc(PlanAssignmentEvent.occurred_at), desc(PlanAssignmentEvent.created_at))
        .limit(1)
    )
    return session.scalar(query)


def _get_worker(session: Session, organization_id: UUID, worker_id: UUID) -> Worker:
    worker = session.scalar(
        select(Worker)
        .options(
            selectinload(Worker.worker_skills).selectinload(WorkerSkill.skill),
            selectinload(Worker.worker_certifications).selectinload(WorkerCertification.certification),
            selectinload(Worker.availability_calendars).selectinload(AvailabilityCalendar.windows),
            selectinload(Worker.shift_templates).selectinload(WorkerShiftTemplate.break_rules),
            selectinload(Worker.home_location),
        )
        .where(Worker.id == worker_id, Worker.organization_id == organization_id)
    )
    if worker is None:
        raise NotFoundError(f"Worker {worker_id} was not found in organization {organization_id}.")
    return worker


def _get_work_order(session: Session, organization_id: UUID, work_order_id: UUID) -> WorkOrder:
    work_order = session.scalar(
        select(WorkOrder)
        .options(selectinload(WorkOrder.requirements), selectinload(WorkOrder.location))
        .where(WorkOrder.id == work_order_id, WorkOrder.organization_id == organization_id)
    )
    if work_order is None:
        raise NotFoundError(
            f"Work order {work_order_id} was not found in organization {organization_id}."
        )
    return work_order


def _resolve_assignment_window(
    work_order: WorkOrder,
    scheduled_start_at: datetime | None,
    scheduled_end_at: datetime | None,
) -> tuple[datetime | None, datetime | None]:
    start_at = scheduled_start_at or work_order.requested_start_at or work_order.due_at
    end_at = scheduled_end_at or work_order.due_at or work_order.requested_start_at

    if start_at is not None:
        start_at = _as_utc(start_at)
    if end_at is not None:
        end_at = _as_utc(end_at)

    if start_at is not None and end_at is not None and end_at <= start_at:
        raise ValidationError("Assignment schedule must end after it starts.")

    return start_at, end_at


def _resolve_assignment_override_crew(
    session: Session,
    organization_id: UUID,
    lead_worker: Worker,
    crew_worker_ids: list[UUID] | None,
    *,
    expected_crew_size: int,
    work_order_title: str,
) -> list[Worker]:
    normalized_worker_ids: list[UUID] = []
    seen_worker_ids: set[UUID] = set()
    for candidate_worker_id in [lead_worker.id, *(crew_worker_ids or [])]:
        if candidate_worker_id in seen_worker_ids:
            continue
        seen_worker_ids.add(candidate_worker_id)
        normalized_worker_ids.append(candidate_worker_id)

    required_crew_size = max(1, expected_crew_size)
    if len(normalized_worker_ids) != required_crew_size:
        raise ValidationError(
            f"{work_order_title} requires a crew of {required_crew_size} workers for this assignment."
        )

    return [_get_worker(session, organization_id, worker_id) for worker_id in normalized_worker_ids]


def _validate_assignment_dispatch_edit(
    session: Session,
    organization_id: UUID,
    run: PlanRun,
    crew_workers: list[Worker],
    lead_worker: Worker,
    work_order: WorkOrder,
    start_at: datetime | None,
    end_at: datetime | None,
    *,
    assignment_id: UUID,
) -> tuple[list[str], list[str], list[str], list[str], int, list[str], int]:
    if lead_worker.id not in {worker.id for worker in crew_workers}:
        raise ValidationError("Lead worker must be included in the reassigned crew.")

    allowed_statuses = set(run.planning_request.get("worker_statuses", []))
    work_order_fact = _work_order_fact_from_record(session, work_order, start_at, end_at)
    matched_skill_codes_by_worker: dict[UUID, list[str]] = {}
    matched_certification_codes_by_worker: dict[UUID, list[str]] = {}

    for worker in crew_workers:
        if allowed_statuses and worker.status not in allowed_statuses:
            raise ValidationError(
                f"Worker {worker.display_name} has status '{worker.status}' which is outside the run scope."
            )

        worker_fact = _worker_fact_from_record(worker, start_at, end_at)
        matched_skill_codes_by_worker[worker.id] = _matched_skill_codes_for_override(
            worker_fact,
            work_order_fact,
        )
        matched_certification_codes_by_worker[worker.id] = sorted(
            set(work_order_fact.required_certification_codes).intersection(
                worker_fact.certification_codes
            )
        )

        if not _availability_covers_assignment(worker_fact.availability_windows, start_at, end_at):
            raise ValidationError(
                f"Worker {worker.display_name} is not available for the selected assignment window."
            )

        if _worker_has_conflicting_assignment(
            session,
            organization_id,
            run.id,
            worker.id,
            assignment_id,
            start_at,
            end_at,
        ):
            raise ValidationError(
                f"Worker {worker.display_name} already has another assignment that overlaps this window."
            )
        if _worker_has_conflicting_active_reservation(
            session,
            organization_id,
            worker.id,
            start_at,
            end_at,
            exclude_assignment_id=assignment_id,
        ):
            raise ValidationError(
                f"Worker {worker.display_name} is already committed by another published assignment in this window."
            )

    required_skill_quantities = {
        code: max(quantity, 1)
        for code, quantity in work_order_fact.required_skill_quantities.items()
    }
    required_certification_quantities = {
        code: max(quantity, 1)
        for code, quantity in work_order_fact.required_certification_quantities.items()
    }

    missing_skill_codes = sorted(
        [
            skill_code
            for skill_code, required_quantity in required_skill_quantities.items()
            if sum(
                1
                for worker in crew_workers
                if skill_code in matched_skill_codes_by_worker[worker.id]
            )
            < required_quantity
        ]
    )
    if missing_skill_codes:
        raise ValidationError(
            "Selected crew does not satisfy required skills for "
            f"{work_order.title}: {', '.join(missing_skill_codes)}."
        )

    missing_certification_codes = sorted(
        [
            certification_code
            for certification_code, required_quantity in required_certification_quantities.items()
            if sum(
                1
                for worker in crew_workers
                if certification_code in matched_certification_codes_by_worker[worker.id]
            )
            < required_quantity
        ]
    )
    if missing_certification_codes:
        raise ValidationError(
            "Selected crew does not satisfy required certifications for "
            f"{work_order.title}: {', '.join(missing_certification_codes)}."
        )

    matched_skill_codes = sorted(required_skill_quantities)
    matched_certification_codes = sorted(required_certification_quantities)
    crew_worker_ids = [str(worker.id) for worker in crew_workers]
    crew_worker_names = [worker.display_name for worker in crew_workers]
    score = sum(
        len(matched_skill_codes_by_worker[worker.id])
        + len(matched_certification_codes_by_worker[worker.id])
        for worker in crew_workers
    )
    estimated_travel_minutes = sum(
        _estimate_assignment_travel_minutes(worker, work_order)
        for worker in crew_workers
    )

    reserved_equipment_ids = _select_equipment_ids_for_assignment(
        session,
        organization_id,
        run.id,
        work_order,
        start_at,
        end_at,
        exclude_assignment_id=assignment_id,
    )

    return (
        crew_worker_ids,
        crew_worker_names,
        matched_skill_codes,
        matched_certification_codes,
        score,
        reserved_equipment_ids,
        estimated_travel_minutes,
    )


def _worker_fact_from_record(
    worker: Worker,
    window_start: datetime | None = None,
    window_end: datetime | None = None,
) -> WorkerFact:
    skill_codes: list[str] = []
    skill_levels: dict[str, int] = {}
    for worker_skill in worker.worker_skills:
        skill_codes.append(worker_skill.skill.code)
        skill_levels[worker_skill.skill.code] = worker_skill.proficiency_level

    certification_codes = [
        worker_certification.certification.code
        for worker_certification in worker.worker_certifications
        if worker_certification.status == "active"
    ]
    calendar_windows, _ = _collect_availability_windows(worker, window_start, window_end)
    shift_windows, has_active_shift_templates, shift_regular_capacity_minutes = (
        _collect_shift_template_windows(worker, window_start, window_end)
    )
    availability_windows = _merge_worker_schedule_windows(calendar_windows, shift_windows)

    return WorkerFact(
        worker_id=str(worker.id),
        display_name=worker.display_name,
        employment_type=worker.employment_type,
        daily_regular_capacity_minutes=_daily_regular_capacity_minutes(worker.employment_type),
        planning_regular_capacity_minutes=shift_regular_capacity_minutes
        if has_active_shift_templates
        else None,
        home_location_id=str(worker.home_location_id) if worker.home_location_id is not None else None,
        home_location_latitude=float(worker.home_location.latitude)
        if worker.home_location is not None and worker.home_location.latitude is not None
        else None,
        home_location_longitude=float(worker.home_location.longitude)
        if worker.home_location is not None and worker.home_location.longitude is not None
        else None,
        skill_codes=skill_codes,
        skill_levels=skill_levels,
        certification_codes=certification_codes,
        available=True,
        availability_windows=availability_windows,
    )


def _daily_regular_capacity_minutes(employment_type: str) -> int:
    normalized = employment_type.strip().lower()
    if normalized == "part_time":
        return 240
    if normalized in {"seasonal", "temporary", "temp"}:
        return 360
    if normalized in {"contractor", "contract"}:
        return 600
    return 480


def _estimate_assignment_travel_minutes(worker: Worker, work_order: WorkOrder) -> int:
    if worker.home_location_id is not None and worker.home_location_id == work_order.location_id:
        return 0
    if (
        worker.home_location is None
        or worker.home_location.latitude is None
        or worker.home_location.longitude is None
        or work_order.location is None
        or work_order.location.latitude is None
        or work_order.location.longitude is None
    ):
        return 0
    return _travel_minutes_between_coordinates(
        float(worker.home_location.latitude),
        float(worker.home_location.longitude),
        float(work_order.location.latitude),
        float(work_order.location.longitude),
    )


def _travel_minutes_between_coordinates(
    left_latitude: float,
    left_longitude: float,
    right_latitude: float,
    right_longitude: float,
) -> int:
    from math import asin, ceil, cos, radians, sin, sqrt

    earth_radius_km = 6371.0
    delta_latitude = radians(right_latitude - left_latitude)
    delta_longitude = radians(right_longitude - left_longitude)
    left_latitude_radians = radians(left_latitude)
    right_latitude_radians = radians(right_latitude)
    a = (
        sin(delta_latitude / 2) ** 2
        + cos(left_latitude_radians)
        * cos(right_latitude_radians)
        * sin(delta_longitude / 2) ** 2
    )
    distance_km = 2 * earth_radius_km * asin(sqrt(a))
    if distance_km <= 0:
        return 0
    return max(1, ceil(distance_km / 45 * 60))


def _work_order_fact_from_record(
    session: Session,
    work_order: WorkOrder,
    start_at: datetime | None,
    end_at: datetime | None,
) -> WorkOrderFact:
    required_skill_codes: list[str] = []
    required_skill_quantities: dict[str, int] = {}
    required_skill_levels: dict[str, int] = {}
    required_certification_codes: list[str] = []
    required_certification_quantities: dict[str, int] = {}

    skill_lookup = {
        str(skill.id): skill.code
        for skill in session.scalars(select(Skill).where(Skill.organization_id == work_order.organization_id))
    }  # type: ignore[name-defined]
    certification_lookup = {
        str(certification.id): certification.code
        for certification in session.scalars(
            select(Certification).where(Certification.organization_id == work_order.organization_id)
        )
    }  # type: ignore[name-defined]

    for requirement in work_order.requirements:
        if requirement.requirement_type == "skill" and requirement.reference_id is not None:
            code = skill_lookup.get(str(requirement.reference_id))
            if code is not None:
                required_skill_codes.append(code)
                required_skill_quantities[code] = (
                    required_skill_quantities.get(code, 0) + max(requirement.quantity, 1)
                )
                required_skill_levels[code] = requirement.min_level or 1
        if requirement.requirement_type == "certification" and requirement.reference_id is not None:
            code = certification_lookup.get(str(requirement.reference_id))
            if code is not None:
                required_certification_codes.append(code)
                required_certification_quantities[code] = (
                    required_certification_quantities.get(code, 0) + max(requirement.quantity, 1)
                )

    return WorkOrderFact(
        work_order_id=str(work_order.id),
        title=work_order.title,
        location_id=str(work_order.location_id) if work_order.location_id is not None else None,
        required_skill_codes=required_skill_codes,
        required_skill_quantities=required_skill_quantities,
        required_skill_levels=required_skill_levels,
        required_certification_codes=required_certification_codes,
        required_certification_quantities=required_certification_quantities,
        required_worker_count=max(
            [1, *required_skill_quantities.values(), *required_certification_quantities.values()]
        ),
        priority=work_order.priority,
        requested_start_at=start_at,
        due_at=end_at,
        location_latitude=float(work_order.location.latitude)
        if work_order.location is not None and work_order.location.latitude is not None
        else None,
        location_longitude=float(work_order.location.longitude)
        if work_order.location is not None and work_order.location.longitude is not None
        else None,
    )


def _matched_skill_codes_for_override(worker: WorkerFact, work_order: WorkOrderFact) -> list[str]:
    matched_skill_codes: list[str] = []
    fallback_skill_codes = set(worker.skill_codes)

    for code in sorted(set(work_order.required_skill_codes)):
        required_level = work_order.required_skill_levels.get(code, 1)
        worker_level = worker.skill_levels.get(code, 1 if code in fallback_skill_codes else 0)
        if worker_level >= required_level:
            matched_skill_codes.append(code)
    return matched_skill_codes


def _availability_covers_assignment(
    availability_windows: list[AvailabilityWindowFact],
    start_at: datetime | None,
    end_at: datetime | None,
) -> bool:
    if not availability_windows:
        return True
    available_windows = [
        window for window in availability_windows if window.availability_type == "available"
    ]
    unavailable_windows = [
        window for window in availability_windows if window.availability_type != "available"
    ]

    if start_at is None or end_at is None:
        if available_windows:
            return True
        return not bool(unavailable_windows)

    has_available_coverage = True
    if available_windows:
        has_available_coverage = any(
            _as_utc(window.start_at) <= start_at and _as_utc(window.end_at) >= end_at
            for window in available_windows
        )
    if not has_available_coverage:
        return False

    return not any(
        _intervals_overlap(window.start_at, window.end_at, start_at, end_at)
        for window in unavailable_windows
    )


def _worker_has_conflicting_assignment(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    worker_id: UUID,
    assignment_id: UUID,
    start_at: datetime | None,
    end_at: datetime | None,
) -> bool:
    if start_at is None or end_at is None:
        return False

    other_assignments = list(
        session.scalars(
            select(PlanAssignment).where(
                PlanAssignment.organization_id == organization_id,
                PlanAssignment.plan_run_id == run_id,
                PlanAssignment.id != assignment_id,
            )
        )
    )
    for assignment in other_assignments:
        crew_worker_ids = set(assignment.crew_worker_ids or [str(assignment.worker_id)])
        if str(worker_id) not in crew_worker_ids:
            continue
        if assignment.scheduled_start_at is None or assignment.scheduled_end_at is None:
            continue
        assignment_start = _as_utc(assignment.scheduled_start_at)
        assignment_end = _as_utc(assignment.scheduled_end_at)
        if not (
            end_at <= assignment_start
            or start_at >= assignment_end
        ):
            return True
    return False


def _worker_has_conflicting_active_reservation(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    start_at: datetime | None,
    end_at: datetime | None,
    *,
    exclude_assignment_id: UUID | None = None,
) -> bool:
    if start_at is None or end_at is None:
        return False

    reservations = list(
        session.scalars(
            select(PlanWorkerReservation).where(
                PlanWorkerReservation.organization_id == organization_id,
                PlanWorkerReservation.worker_id == worker_id,
                PlanWorkerReservation.status == "active",
            )
        )
    )
    for reservation in reservations:
        if exclude_assignment_id is not None and reservation.plan_assignment_id == exclude_assignment_id:
            continue
        if _intervals_conflict_with_unknown_bounds(
            reservation.reserved_start_at,
            reservation.reserved_end_at,
            start_at,
            end_at,
        ):
            return True
    return False


def _equipment_has_conflicting_active_reservation(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    start_at: datetime | None,
    end_at: datetime | None,
    *,
    exclude_assignment_id: UUID | None = None,
) -> bool:
    if start_at is None or end_at is None:
        return False

    reservations = list(
        session.scalars(
            select(PlanEquipmentReservation).where(
                PlanEquipmentReservation.organization_id == organization_id,
                PlanEquipmentReservation.equipment_id == equipment_id,
                PlanEquipmentReservation.status == "active",
            )
        )
    )
    for reservation in reservations:
        if exclude_assignment_id is not None and reservation.plan_assignment_id == exclude_assignment_id:
            continue
        if _intervals_conflict_with_unknown_bounds(
            reservation.reserved_start_at,
            reservation.reserved_end_at,
            start_at,
            end_at,
        ):
            return True
    return False


def _load_plan_assignments_for_reservation_sync(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
) -> list[PlanAssignment]:
    return list(
        session.scalars(
            select(PlanAssignment)
            .options(
                selectinload(PlanAssignment.work_order).selectinload(WorkOrder.requirements),
                selectinload(PlanAssignment.worker_reservations),
                selectinload(PlanAssignment.material_reservations).selectinload(
                    PlanMaterialReservation.inventory_position
                ),
                selectinload(PlanAssignment.equipment_reservations),
            )
            .where(
                PlanAssignment.organization_id == organization_id,
                PlanAssignment.plan_run_id == run_id,
            )
            .order_by(PlanAssignment.scheduled_start_at.asc(), PlanAssignment.created_at.asc())
        )
    )


def _ensure_run_has_no_persisted_reservations(session: Session, run_id: UUID) -> None:
    for model in (PlanWorkerReservation, PlanMaterialReservation, PlanEquipmentReservation):
        if session.scalar(select(model.id).where(model.plan_run_id == run_id).limit(1)) is not None:
            raise ConflictError("Plan run already has persisted reservation records.")


def _ensure_assignment_can_be_reassigned(run: PlanRun, assignment: PlanAssignment) -> None:
    if assignment.assignment_status == "cancelled":
        raise ConflictError("Cancelled assignments cannot be reassigned.")
    _ensure_assignment_is_published(run, assignment)
    if assignment.execution_status == "completed":
        raise ConflictError("Completed assignments cannot be reassigned.")
    if assignment.execution_status == "in_progress":
        raise ConflictError("In-progress assignments cannot be reassigned.")


def _ensure_assignment_can_be_cancelled(run: PlanRun, assignment: PlanAssignment) -> None:
    if assignment.assignment_status == "cancelled":
        raise ConflictError("Assignment is already cancelled.")
    _ensure_assignment_is_published(run, assignment)
    if assignment.execution_status == "completed":
        raise ConflictError("Completed assignments cannot be cancelled.")
    if assignment.execution_status == "in_progress":
        raise ConflictError("In-progress assignments cannot be cancelled.")


def _publish_assignment_reservations(
    session: Session,
    organization_id: UUID,
    run: PlanRun,
    assignment: PlanAssignment,
    published_at: datetime,
) -> None:
    start_at, end_at = _require_assignment_window(assignment)
    _create_worker_reservations_for_assignment(
        session,
        organization_id,
        run,
        assignment,
        start_at,
        end_at,
    )

    assignment.reserved_equipment_ids = _select_equipment_ids_for_assignment(
        session,
        organization_id,
        run.id,
        assignment.work_order,
        start_at,
        end_at,
        exclude_assignment_id=assignment.id,
    )
    _create_equipment_reservations_for_assignment(
        session,
        organization_id,
        run,
        assignment,
        start_at,
        end_at,
    )

    _create_material_reservations_for_assignment(
        session,
        organization_id,
        run.id,
        assignment,
    )


def _create_worker_reservations_for_assignment(
    session: Session,
    organization_id: UUID,
    run: PlanRun,
    assignment: PlanAssignment,
    start_at: datetime,
    end_at: datetime,
) -> None:
    crew_worker_ids = [UUID(worker_id) for worker_id in (assignment.crew_worker_ids or [str(assignment.worker_id)])]
    crew_worker_names = list(assignment.crew_worker_names or [assignment.worker_name_snapshot])
    for index, worker_id in enumerate(crew_worker_ids):
        worker_label = crew_worker_names[index] if index < len(crew_worker_names) else str(worker_id)
        if _worker_has_conflicting_active_reservation(
            session,
            organization_id,
            worker_id,
            start_at,
            end_at,
            exclude_assignment_id=assignment.id,
        ):
            raise ConflictError(
                f"Cannot commit assignment because worker {worker_label} is already reserved "
                f"for another published assignment in the selected window."
            )

    for worker_id in crew_worker_ids:
        session.add(
            PlanWorkerReservation(
                organization_id=organization_id,
                plan_run_id=run.id,
                plan_assignment_id=assignment.id,
                work_order_id=assignment.work_order_id,
                worker_id=worker_id,
                status="active",
                reserved_start_at=start_at,
                reserved_end_at=end_at,
            )
        )


def _create_equipment_reservations_for_assignment(
    session: Session,
    organization_id: UUID,
    run: PlanRun,
    assignment: PlanAssignment,
    start_at: datetime,
    end_at: datetime,
) -> None:
    for equipment_id in assignment.reserved_equipment_ids:
        equipment_uuid = UUID(equipment_id)
        if _equipment_has_conflicting_active_reservation(
            session,
            organization_id,
            equipment_uuid,
            start_at,
            end_at,
            exclude_assignment_id=assignment.id,
        ):
            raise ConflictError(
                "Cannot commit assignment because at least one reserved equipment unit is already "
                "committed by another published assignment in the selected window."
            )
        session.add(
            PlanEquipmentReservation(
                organization_id=organization_id,
                plan_run_id=run.id,
                plan_assignment_id=assignment.id,
                work_order_id=assignment.work_order_id,
                equipment_id=equipment_uuid,
                status="active",
                reserved_start_at=start_at,
                reserved_end_at=end_at,
            )
        )


def _require_assignment_window(assignment: PlanAssignment) -> tuple[datetime, datetime]:
    if assignment.scheduled_start_at is None or assignment.scheduled_end_at is None:
        raise ConflictError(
            "Cannot publish an assignment that does not have a complete scheduled window."
        )
    return _as_utc(assignment.scheduled_start_at), _as_utc(assignment.scheduled_end_at)


def _create_material_reservations_for_assignment(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment: PlanAssignment,
) -> None:
    if not assignment.reserved_material_quantities:
        return
    if assignment.work_order.location_id is None:
        raise ConflictError(
            f"Cannot publish assignment for work order {assignment.work_order_id} without a location."
        )

    material_codes = sorted(assignment.reserved_material_quantities)
    materials_by_code = {
        material.sku: material
        for material in session.scalars(
            select(Material).where(
                Material.organization_id == organization_id,
                Material.sku.in_(material_codes),
            )
        )
    }

    for material_code, quantity in sorted(assignment.reserved_material_quantities.items()):
        material = materials_by_code.get(material_code)
        if material is None:
            raise ConflictError(
                f"Cannot publish assignment because material '{material_code}' is no longer available."
            )

        inventory_position = session.scalar(
            select(InventoryPosition).where(
                InventoryPosition.material_id == material.id,
                InventoryPosition.location_id == assignment.work_order.location_id,
            )
        )
        if inventory_position is None:
            raise ConflictError(
                f"Cannot publish assignment because material '{material_code}' has no inventory position "
                f"at location {assignment.work_order.location_id}."
            )

        available_quantity = inventory_position.on_hand_quantity - inventory_position.reserved_quantity
        if available_quantity < quantity:
            raise ConflictError(
                f"Cannot publish assignment because material '{material_code}' no longer has enough "
                "available stock."
            )

        inventory_position.reserved_quantity += quantity
        session.add(
            PlanMaterialReservation(
                organization_id=organization_id,
                plan_run_id=run_id,
                plan_assignment_id=assignment.id,
                work_order_id=assignment.work_order_id,
                material_id=material.id,
                inventory_position_id=inventory_position.id,
                quantity=quantity,
                status="active",
            )
        )


def _required_equipment_type_quantities_for_work_order(
    session: Session,
    organization_id: UUID,
    work_order: WorkOrder,
) -> dict[str, int]:
    equipment_type_ids = sorted(
        {
            requirement.reference_id
            for requirement in work_order.requirements
            if requirement.requirement_type == "equipment_type" and requirement.reference_id is not None
        }
    )
    if not equipment_type_ids:
        return {}

    equipment_type_codes = {
        equipment_type.id: equipment_type.code
        for equipment_type in session.scalars(
            select(EquipmentType).where(
                EquipmentType.organization_id == organization_id,
                EquipmentType.id.in_(equipment_type_ids),
                EquipmentType.status == "active",
            )
        )
    }
    required_quantities: dict[str, int] = {}
    for requirement in work_order.requirements:
        if requirement.requirement_type != "equipment_type" or requirement.reference_id is None:
            continue
        equipment_type_code = equipment_type_codes.get(requirement.reference_id)
        if equipment_type_code is None:
            raise ValidationError(
                f"Work order {work_order.id} references an unavailable equipment type."
            )
        required_quantities[equipment_type_code] = (
            required_quantities.get(equipment_type_code, 0) + requirement.quantity
        )
    return required_quantities


def _select_equipment_ids_for_assignment(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    work_order: WorkOrder,
    start_at: datetime | None,
    end_at: datetime | None,
    *,
    exclude_assignment_id: UUID | None,
) -> list[str]:
    required_quantities = _required_equipment_type_quantities_for_work_order(
        session,
        organization_id,
        work_order,
    )
    if not required_quantities:
        return []
    if work_order.location_id is None:
        raise ValidationError("Equipment requirements require the work order to have a location.")
    if start_at is None or end_at is None:
        raise ValidationError("Equipment requirements require a complete assignment window.")

    conflicting_equipment_ids = _conflicting_equipment_ids_within_run(
        session,
        organization_id,
        run_id,
        start_at,
        end_at,
        exclude_assignment_id=exclude_assignment_id,
    )
    equipment_records = list(
        session.scalars(
            select(Equipment)
            .options(
                selectinload(Equipment.equipment_type),
                selectinload(Equipment.availability_calendars).selectinload(
                    EquipmentAvailabilityCalendar.windows
                ),
            )
            .where(
                Equipment.organization_id == organization_id,
                Equipment.location_id == work_order.location_id,
                Equipment.status == "active",
            )
            .order_by(Equipment.equipment_code.asc())
        )
    )

    selected_ids: list[str] = []
    used_equipment_ids: set[UUID] = set(conflicting_equipment_ids)

    for equipment_type_code, quantity in sorted(required_quantities.items()):
        matches_for_type = 0
        for equipment in equipment_records:
            if equipment.id in used_equipment_ids:
                continue
            if equipment.equipment_type.status != "active":
                continue
            if equipment.equipment_type.code != equipment_type_code:
                continue
            base_windows, _ = _collect_availability_windows(equipment, start_at, end_at)
            if not _availability_covers_assignment(base_windows, start_at, end_at):
                continue
            if _equipment_has_conflicting_active_reservation(
                session,
                organization_id,
                equipment.id,
                start_at,
                end_at,
                exclude_assignment_id=exclude_assignment_id,
            ):
                continue
            selected_ids.append(str(equipment.id))
            used_equipment_ids.add(equipment.id)
            matches_for_type += 1
            if matches_for_type == quantity:
                break
        if matches_for_type != quantity:
            raise ValidationError(
                f"No available equipment satisfies the '{equipment_type_code}' requirement for "
                f"{work_order.title} in the selected window."
            )

    return selected_ids


def _conflicting_equipment_ids_within_run(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    start_at: datetime,
    end_at: datetime,
    *,
    exclude_assignment_id: UUID | None,
) -> set[UUID]:
    query = select(PlanAssignment).where(
        PlanAssignment.organization_id == organization_id,
        PlanAssignment.plan_run_id == run_id,
    )
    if exclude_assignment_id is not None:
        query = query.where(PlanAssignment.id != exclude_assignment_id)

    conflicting_ids: set[UUID] = set()
    for assignment in session.scalars(query):
        if assignment.scheduled_start_at is None or assignment.scheduled_end_at is None:
            continue
        if not _intervals_overlap(
            assignment.scheduled_start_at,
            assignment.scheduled_end_at,
            start_at,
            end_at,
        ):
            continue
        conflicting_ids.update(UUID(equipment_id) for equipment_id in assignment.reserved_equipment_ids)
    return conflicting_ids


def _sync_assignment_reservations_for_execution_event(
    assignment: PlanAssignment,
    occurred_at: datetime,
    event_type: str,
) -> None:
    _extend_active_assignment_reservations(assignment, occurred_at)

    if event_type != "completed":
        return

    _release_active_assignment_reservations(
        assignment,
        occurred_at,
        release_materials=True,
        consume_materials=True,
    )


def _release_active_assignment_reservations(
    assignment: PlanAssignment,
    occurred_at: datetime,
    *,
    release_materials: bool,
    consume_materials: bool = False,
) -> None:
    for reservation in assignment.worker_reservations:
        if reservation.status != "active":
            continue
        reservation.status = "released"
        reservation.released_at = occurred_at

    for reservation in assignment.equipment_reservations:
        if reservation.status != "active":
            continue
        reservation.status = "released"
        reservation.released_at = occurred_at

    if not release_materials:
        return

    for reservation in assignment.material_reservations:
        if reservation.status != "active":
            continue
        inventory_position = reservation.inventory_position
        if inventory_position.reserved_quantity < reservation.quantity:
            raise ConflictError("Material reservation state is inconsistent with inventory reservations.")
        inventory_position.reserved_quantity -= reservation.quantity
        if consume_materials:
            if inventory_position.on_hand_quantity < reservation.quantity:
                raise ConflictError("Material inventory cannot be consumed below zero.")
            inventory_position.on_hand_quantity -= reservation.quantity
            reservation.status = "consumed"
        else:
            reservation.status = "released"
        reservation.released_at = occurred_at


def _append_assignment_audit_event(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    assignment: PlanAssignment,
    *,
    event_type: str,
    occurred_at: datetime,
    actor_name: str,
    note: str | None,
    payload_json: dict[str, object],
) -> None:
    session.add(
        PlanAssignmentEvent(
            organization_id=organization_id,
            plan_run_id=run_id,
            plan_assignment_id=assignment.id,
            event_type=event_type,
            occurred_at=occurred_at,
            actor_name=actor_name,
            note=note,
            payload_json=payload_json,
        )
    )


def _ensure_unique_dispatch_queue_name(
    session: Session,
    organization_id: UUID,
    run_id: UUID,
    name: str,
) -> None:
    existing_queue = session.scalar(
        select(PlanDispatchQueue.id).where(
            PlanDispatchQueue.organization_id == organization_id,
            PlanDispatchQueue.plan_run_id == run_id,
            PlanDispatchQueue.name == name,
        )
    )
    if existing_queue is not None:
        raise ConflictError(
            f"Dispatch queue '{name}' already exists in this run."
        )


def _ensure_unique_dispatch_queue_template_name(
    session: Session,
    organization_id: UUID,
    name: str,
    *,
    exclude_id: UUID | None = None,
) -> None:
    query = select(PlanDispatchQueueTemplate.id).where(
        PlanDispatchQueueTemplate.organization_id == organization_id,
        PlanDispatchQueueTemplate.name == name,
    )
    if exclude_id is not None:
        query = query.where(PlanDispatchQueueTemplate.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(
            f"Dispatch queue template '{name}' already exists in this organization."
        )


def _normalize_dispatch_filter_values(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized_values: list[str] = []
    seen_values: set[str] = set()
    for value in values:
        candidate = value.strip()
        if not candidate:
            continue
        if candidate in seen_values:
            continue
        seen_values.add(candidate)
        normalized_values.append(candidate)
    return normalized_values


def _normalize_role_code_values(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized_values: list[str] = []
    seen_values: set[str] = set()
    for value in values:
        candidate = value.strip().lower()
        if not candidate:
            continue
        if candidate in seen_values:
            continue
        seen_values.add(candidate)
        normalized_values.append(candidate)
    return normalized_values


def _assignment_matches_dispatch_filters(
    assignment: PlanAssignment,
    *,
    assignment_statuses: list[str] | None,
    execution_statuses: list[str] | None,
    handoff_statuses: list[str] | None,
    source_kinds: list[str] | None,
) -> bool:
    if assignment_statuses and assignment.assignment_status not in assignment_statuses:
        return False
    if execution_statuses and assignment.execution_status not in execution_statuses:
        return False
    if handoff_statuses and assignment.dispatch_handoff_status not in handoff_statuses:
        return False
    if source_kinds and assignment.source_kind not in source_kinds:
        return False
    return True


def _require_dispatch_queue_apply_permissions(
    session: Session,
    organization_id: UUID,
    *,
    actor_name: str,
    actor_user_id: UUID | None,
    allowed_role_codes: list[str] | None,
    context_label: str,
) -> None:
    required_role_codes = _normalize_role_code_values(allowed_role_codes)
    if not required_role_codes:
        return

    actor_user = _resolve_dispatch_actor_user(
        session,
        organization_id,
        actor_name=actor_name,
        actor_user_id=actor_user_id,
    )
    actor_role_codes = {
        assignment.role.code.strip().lower()
        for assignment in actor_user.role_assignments
        if assignment.role is not None and assignment.role.code and assignment.role.code.strip()
    }
    if actor_role_codes.intersection(required_role_codes):
        return
    raise AuthorizationError(
        f"Actor '{actor_name}' is not permitted to apply {context_label}. "
        f"Required role codes: {', '.join(required_role_codes)}."
    )


def _resolve_dispatch_actor_user(
    session: Session,
    organization_id: UUID,
    *,
    actor_name: str,
    actor_user_id: UUID | None,
) -> User:
    if actor_user_id is not None:
        actor_user = session.scalar(
            select(User)
            .options(selectinload(User.role_assignments).selectinload(UserRole.role))
            .where(
                User.organization_id == organization_id,
                User.id == actor_user_id,
            )
            .limit(1)
        )
        if actor_user is None:
            raise NotFoundError(
                f"Actor user {actor_user_id} was not found in organization {organization_id}."
            )
        if actor_user.status != "active":
            raise AuthorizationError(
                f"Actor user {actor_user.display_name} is not active and cannot apply queue actions."
            )
        return actor_user

    actor_name_normalized = actor_name.strip().lower()
    if not actor_name_normalized:
        raise ValidationError("Queue action actor_name is required.")

    matching_users = list(
        session.scalars(
            select(User)
            .options(selectinload(User.role_assignments).selectinload(UserRole.role))
            .where(
                User.organization_id == organization_id,
                User.status == "active",
                or_(
                    func.lower(User.display_name) == actor_name_normalized,
                    func.lower(User.email) == actor_name_normalized,
                ),
            )
            .order_by(User.display_name.asc())
        )
    )
    if not matching_users:
        raise AuthorizationError(
            "Role-gated queue apply requires actor_name to match an active organization "
            "user display name or email, or actor_user_id to be provided."
        )
    if len(matching_users) > 1:
        raise ValidationError(
            "Queue actor_name matched multiple users. Provide actor_user_id for an unambiguous identity."
        )
    return matching_users[0]


def _extend_active_assignment_reservations(
    assignment: PlanAssignment,
    occurred_at: datetime,
) -> None:
    for reservation in assignment.worker_reservations:
        if reservation.status != "active":
            continue
        if reservation.reserved_end_at is None or occurred_at > _as_utc(reservation.reserved_end_at):
            reservation.reserved_end_at = occurred_at

    for reservation in assignment.equipment_reservations:
        if reservation.status != "active":
            continue
        if reservation.reserved_end_at is None or occurred_at > _as_utc(reservation.reserved_end_at):
            reservation.reserved_end_at = occurred_at


def _intervals_conflict_with_unknown_bounds(
    left_start: datetime | None,
    left_end: datetime | None,
    right_start: datetime | None,
    right_end: datetime | None,
) -> bool:
    if left_start is None or left_end is None or right_start is None or right_end is None:
        return True
    return _intervals_overlap(left_start, left_end, right_start, right_end)


def _refresh_run_summary_from_assignments(run: PlanRun) -> None:
    current_summary = PlanRunSummary.model_validate(run.summary)
    assignment_models = [_candidate_assignment_from_record(assignment) for assignment in run.assignments]
    assigned_work_order_ids = {assignment.work_order_id for assignment in assignment_models}
    filtered_unassigned = [
        item for item in current_summary.unassigned if item.work_order_id not in assigned_work_order_ids
    ]
    run.summary = current_summary.model_copy(
        update={
            "assignments": assignment_models,
            "unassigned": filtered_unassigned,
        }
    ).model_dump(mode="json")


def _candidate_assignment_from_record(assignment: PlanAssignment) -> CandidateAssignment:
    return CandidateAssignment(
        work_order_id=str(assignment.work_order_id),
        worker_id=str(assignment.worker_id),
        worker_name=assignment.worker_name_snapshot,
        crew_worker_ids=list(assignment.crew_worker_ids or [str(assignment.worker_id)]),
        crew_worker_names=list(assignment.crew_worker_names or [assignment.worker_name_snapshot]),
        crew_size_required=max(1, assignment.crew_size_required or 1),
        score=assignment.score,
        matched_skill_codes=list(assignment.matched_skill_codes or []),
        matched_certification_codes=list(assignment.matched_certification_codes or []),
        reserved_material_quantities=dict(assignment.reserved_material_quantities or {}),
        reserved_equipment_ids=list(assignment.reserved_equipment_ids or []),
        scheduled_start_at=assignment.scheduled_start_at,
        scheduled_end_at=assignment.scheduled_end_at,
        estimated_travel_minutes=max(0, assignment.estimated_travel_minutes or 0),
        estimated_overtime_minutes=max(0, assignment.estimated_overtime_minutes or 0),
    )


def _reset_run_review_state(run: PlanRun) -> None:
    run.review_status = "draft"
    run.approval_note = None
    run.approved_at = None
    run.approved_by_name = None


def _ensure_run_can_be_edited(run: PlanRun) -> None:
    if run.publication_status == "published":
        raise ConflictError("Published plan runs cannot be edited.")


def _ensure_assignment_is_published(run: PlanRun, assignment: PlanAssignment) -> None:
    if run.publication_status != "published" or assignment.assignment_status != "published":
        raise ConflictError("Execution events can only be recorded against published assignments.")


def _apply_assignment_execution_event(
    assignment: PlanAssignment,
    event_type: str,
    occurred_at: datetime,
    note: str | None,
    reason_code: str | None,
) -> None:
    if assignment.execution_status == "completed":
        raise ConflictError("Completed assignments cannot receive additional execution events.")

    if event_type == "started":
        if assignment.execution_status == "in_progress":
            raise ConflictError("Assignment is already in progress.")
        if assignment.actual_end_at is not None and occurred_at > _as_utc(assignment.actual_end_at):
            raise ValidationError("Start event cannot occur after the recorded completion time.")
        assignment.execution_status = "in_progress"
        if assignment.actual_start_at is None or occurred_at < _as_utc(assignment.actual_start_at):
            assignment.actual_start_at = occurred_at
    elif event_type == "blocked":
        if not note or not note.strip():
            raise ValidationError("Blocked execution events require a note.")
        if not reason_code or not reason_code.strip():
            raise ValidationError("Blocked execution events require a reason code.")
        assignment.execution_status = "blocked"
    elif event_type == "completed":
        if assignment.actual_start_at is None:
            assignment.actual_start_at = occurred_at
        actual_start_at = _as_utc(assignment.actual_start_at)
        if occurred_at < actual_start_at:
            raise ValidationError("Completion cannot be recorded before the actual start time.")
        assignment.execution_status = "completed"
        assignment.actual_end_at = occurred_at
        assignment.actual_duration_minutes = int(
            (occurred_at - actual_start_at).total_seconds() // 60
        )
    else:
        raise ValidationError(f"Unsupported execution event type '{event_type}'.")

    assignment.latest_execution_event_at = occurred_at


def _load_operations_report_assignments(
    session: Session,
    organization_id: UUID,
    filters: OperationsReportFilters,
) -> list[PlanAssignment]:
    assignments = list(
        session.scalars(
            select(PlanAssignment)
            .options(
                selectinload(PlanAssignment.plan_run),
                selectinload(PlanAssignment.work_order).selectinload(WorkOrder.location),
                selectinload(PlanAssignment.work_order).selectinload(WorkOrder.planning_unit),
                selectinload(PlanAssignment.events),
                selectinload(PlanAssignment.worker_reservations),
                selectinload(PlanAssignment.material_reservations)
                .selectinload(PlanMaterialReservation.material),
                selectinload(PlanAssignment.material_reservations)
                .selectinload(PlanMaterialReservation.inventory_position)
                .selectinload(InventoryPosition.location),
                selectinload(PlanAssignment.equipment_reservations)
                .selectinload(PlanEquipmentReservation.equipment)
                .selectinload(Equipment.equipment_type),
                selectinload(PlanAssignment.equipment_reservations)
                .selectinload(PlanEquipmentReservation.equipment)
                .selectinload(Equipment.location),
            )
            .where(
                PlanAssignment.organization_id == organization_id,
                PlanAssignment.assignment_status.in_(["published", "cancelled"]),
            )
        )
    )
    return [
        assignment
        for assignment in assignments
        if _assignment_matches_operations_filters(assignment, filters)
    ]


def _assignment_matches_operations_filters(
    assignment: PlanAssignment,
    filters: OperationsReportFilters,
) -> bool:
    work_order = assignment.work_order
    if filters.location_id is not None and work_order.location_id != filters.location_id:
        return False
    if filters.planning_unit_id is not None and work_order.planning_unit_id != filters.planning_unit_id:
        return False
    if filters.window_start is None or filters.window_end is None:
        return True

    interval_start = assignment.scheduled_start_at or assignment.actual_start_at or assignment.plan_run.published_at
    interval_end = assignment.scheduled_end_at or assignment.actual_end_at or assignment.plan_run.published_at
    if interval_start is None or interval_end is None:
        return True
    return _intervals_overlap(interval_start, interval_end, filters.window_start, filters.window_end)


def _increment_execution_status_counter(bucket: dict[str, object], execution_status: str) -> None:
    key = f"assignments_{execution_status}"
    if key not in bucket:
        bucket[key] = 0
    bucket[key] = int(bucket[key]) + 1


def _bounded_duration_minutes(
    start_at: datetime | None,
    end_at: datetime | None,
    window_start: datetime | None,
    window_end: datetime | None,
) -> int:
    effective_start = start_at
    effective_end = end_at
    if effective_start is None and window_start is not None:
        effective_start = window_start
    if effective_end is None and window_end is not None:
        effective_end = window_end
    if effective_start is None or effective_end is None:
        return 0

    effective_start = _as_utc(effective_start)
    effective_end = _as_utc(effective_end)
    if window_start is not None:
        effective_start = max(effective_start, _as_utc(window_start))
    if window_end is not None:
        effective_end = min(effective_end, _as_utc(window_end))
    if effective_end <= effective_start:
        return 0
    return int((effective_end - effective_start).total_seconds() // 60)


def _operations_reporting_anchor(assignment: PlanAssignment) -> datetime | None:
    return assignment.scheduled_start_at or assignment.actual_start_at or assignment.plan_run.published_at


def _operations_reporting_interval_end(assignment: PlanAssignment) -> datetime | None:
    return assignment.scheduled_end_at or assignment.actual_end_at or assignment.plan_run.published_at


def _operations_trend_granularity(
    assignments: list[PlanAssignment],
    filters: OperationsReportFilters,
) -> str:
    span_minutes = _operations_pressure_window_minutes(assignments, filters)
    if span_minutes is None:
        return "day"
    span_days = max(1, span_minutes // (24 * 60))
    return "week" if span_days > 28 else "day"


def _operations_pressure_window_minutes(
    assignments: list[PlanAssignment],
    filters: OperationsReportFilters,
) -> int | None:
    if filters.window_start is not None and filters.window_end is not None:
        window_minutes = _bounded_duration_minutes(
            filters.window_start,
            filters.window_end,
            filters.window_start,
            filters.window_end,
        )
        return window_minutes or None

    starts = [
        _as_utc(anchor)
        for assignment in assignments
        if (anchor := _operations_reporting_anchor(assignment)) is not None
    ]
    ends = [
        _as_utc(end_at)
        for assignment in assignments
        if (end_at := _operations_reporting_interval_end(assignment)) is not None
    ]
    if not starts or not ends:
        return None
    earliest = min(starts)
    latest = max(ends)
    if latest <= earliest:
        return 60
    return int((latest - earliest).total_seconds() // 60)


def _operations_trend_bucket_start(anchor_at: datetime, granularity: str) -> datetime:
    anchor = _as_utc(anchor_at).replace(hour=0, minute=0, second=0, microsecond=0)
    if granularity == "week":
        return anchor - timedelta(days=anchor.weekday())
    return anchor


def _operations_trend_bucket_end(bucket_start: datetime, granularity: str) -> datetime:
    return bucket_start + timedelta(days=7 if granularity == "week" else 1)


def _operations_trend_bucket_label(
    bucket_start: datetime,
    bucket_end: datetime,
    granularity: str,
) -> str:
    if granularity == "week":
        return f"{_format_bucket_date(bucket_start)} - {_format_bucket_date(bucket_end - timedelta(days=1))}"
    return _format_bucket_date(bucket_start)


def _format_bucket_date(value: datetime) -> str:
    return value.strftime("%b %d").replace(" 0", " ")


def _safe_percent(numerator: int, denominator: int | None) -> float | None:
    if denominator is None or denominator <= 0:
        return None
    return round((numerator / denominator) * 100, 1)


def _build_operations_bottlenecks(
    *,
    worker_aggregates: dict[UUID, dict[str, object]],
    location_aggregates: dict[str, dict[str, object]],
    material_aggregates: dict[UUID, dict[str, object]],
    equipment_aggregates: dict[UUID, dict[str, object]],
    pressure_window_minutes: int | None,
) -> list[OperationsBottleneckItem]:
    bottlenecks: list[OperationsBottleneckItem] = []

    for values in worker_aggregates.values():
        planned_minutes = int(values["planned_minutes"])
        actual_minutes = int(values["actual_minutes"])
        blocked_event_count = int(values["blocked_event_count"])
        delayed_start_count = int(values["delayed_start_count"])
        active_reservations = int(values["active_reservations"])
        utilization_percent = _safe_percent(planned_minutes, pressure_window_minutes)
        severity_score = (
            blocked_event_count * 6
            + int(values["assignments_blocked"]) * 8
            + delayed_start_count * 4
            + active_reservations * 2
            + int((utilization_percent or 0) // 10)
        )
        if severity_score <= 0 and planned_minutes <= 0:
            continue
        bottlenecks.append(
            OperationsBottleneckItem(
                category="worker",
                label=str(values["worker_name"]),
                secondary_label="Worker load",
                detail=f"{planned_minutes} planned min · {actual_minutes} actual min",
                severity_score=severity_score,
                assignments_total=int(values["assignments_total"]),
                assignments_blocked=int(values["assignments_blocked"]),
                blocked_event_count=blocked_event_count,
                delayed_start_count=delayed_start_count,
                active_reservations=active_reservations,
                utilization_percent=utilization_percent,
            )
        )

    for values in location_aggregates.values():
        planned_minutes = int(values["planned_minutes"])
        actual_minutes = int(values["actual_minutes"])
        blocked_event_count = int(values["blocked_event_count"])
        delayed_start_count = int(values["delayed_start_count"])
        active_reservations = int(values["active_reservations"])
        severity_score = (
            blocked_event_count * 5
            + int(values["assignments_blocked"]) * 7
            + delayed_start_count * 4
            + active_reservations * 2
        )
        if severity_score <= 0 and int(values["assignments_total"]) <= 0:
            continue
        bottlenecks.append(
            OperationsBottleneckItem(
                category="location",
                label=str(values["location_name"]),
                secondary_label="Site pressure",
                detail=f"{planned_minutes} planned min · {actual_minutes} actual min",
                severity_score=severity_score,
                assignments_total=int(values["assignments_total"]),
                assignments_blocked=int(values["assignments_blocked"]),
                blocked_event_count=blocked_event_count,
                delayed_start_count=delayed_start_count,
                active_reservations=active_reservations,
            )
        )

    for values in material_aggregates.values():
        current_scope_pressure = int(values["active_reserved_quantity"]) + int(values["consumed_quantity"])
        total_known_units = int(values["on_hand_quantity"]) + int(values["consumed_quantity"])
        utilization_percent = _safe_percent(current_scope_pressure, total_known_units)
        available_quantity = int(values["available_quantity"])
        severity_score = (
            int(current_scope_pressure * 6)
            + (18 if available_quantity <= 0 else 10 if available_quantity <= 1 else 0)
            + int((utilization_percent or 0) // 5)
        )
        if severity_score <= 0:
            continue
        bottlenecks.append(
            OperationsBottleneckItem(
                category="material",
                label=str(values["material_name"]),
                secondary_label=str(values["location_name"]),
                detail=(
                    f"{int(values['active_reserved_quantity'])} reserved in scope · "
                    f"{available_quantity} available · {int(values['consumed_quantity'])} consumed"
                ),
                severity_score=severity_score,
                assignments_total=int(values["assignments_total"]),
                assignments_blocked=0,
                active_reservations=int(values["active_reserved_quantity"]),
                utilization_percent=utilization_percent,
            )
        )

    for values in equipment_aggregates.values():
        reserved_minutes = int(values["reserved_minutes"])
        active_reservations = int(values["active_reservations"])
        utilization_percent = _safe_percent(reserved_minutes, pressure_window_minutes)
        severity_score = (
            active_reservations * 8
            + int(values["assignments_total"]) * 2
            + int((utilization_percent or 0) // 5)
        )
        if severity_score <= 0:
            continue
        bottlenecks.append(
            OperationsBottleneckItem(
                category="equipment",
                label=str(values["equipment_code"]),
                secondary_label=f"{values['equipment_type_name']} · {values['location_name']}",
                detail=f"{reserved_minutes} reserved min · {int(values['assignments_total'])} assignments",
                severity_score=severity_score,
                assignments_total=int(values["assignments_total"]),
                assignments_blocked=0,
                active_reservations=active_reservations,
                utilization_percent=utilization_percent,
            )
        )

    bottlenecks.sort(
        key=lambda item: (
            -item.severity_score,
            -item.assignments_blocked,
            -item.blocked_event_count,
            item.label.lower(),
        )
    )
    return bottlenecks[:8]


def generate_organization_stub_plan(
    session: Session,
    organization_id: UUID,
    payload: OrganizationPlanningRequest,
) -> PlanRunSummary:
    planning_request, projection_issues = build_organization_planning_request(
        session,
        organization_id,
        payload,
    )
    summary = generate_stub_plan(planning_request)
    return summary.model_copy(update={"issues": [*projection_issues, *summary.issues]})


def _ensure_unique_planning_horizon_name(
    session: Session,
    organization_id: UUID,
    name: str,
    exclude_id: UUID | None = None,
) -> None:
    query = select(PlanningHorizon).where(
        PlanningHorizon.organization_id == organization_id,
        PlanningHorizon.name == name,
    )
    if exclude_id is not None:
        query = query.where(PlanningHorizon.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Planning horizon name '{name}' is already in use for this organization.")


def _validate_horizon_range(start_at: datetime, end_at: datetime) -> None:
    if _as_utc(end_at) <= _as_utc(start_at):
        raise ValidationError("Planning horizon end_at must be later than start_at.")


def _ensure_unique_plan_scenario_name(
    session: Session,
    organization_id: UUID,
    name: str,
    *,
    exclude_id: UUID | None = None,
) -> None:
    query = select(PlanScenario).where(
        PlanScenario.organization_id == organization_id,
        PlanScenario.name == name,
    )
    if exclude_id is not None:
        query = query.where(PlanScenario.id != exclude_id)

    if session.scalar(query) is not None:
        raise ConflictError(f"Plan scenario name '{name}' already exists in this organization.")


def _normalize_scenario_labels(labels: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for label in labels:
        candidate = " ".join(label.strip().split())
        if not candidate:
            continue
        lowered = candidate.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        normalized.append(candidate[:32])
    return normalized[:12]


def _generate_unique_copy_name(
    session: Session,
    organization_id: UUID,
    base_name: str,
) -> str:
    copy_index = 1
    while True:
        suffix = " Copy" if copy_index == 1 else f" Copy {copy_index}"
        candidate = f"{base_name[: max(1, 255 - len(suffix))].rstrip()}{suffix}"
        query = select(PlanScenario.id).where(
            PlanScenario.organization_id == organization_id,
            PlanScenario.name == candidate,
        )
        if session.scalar(query) is None:
            return candidate
        copy_index += 1


def _load_work_order_titles(
    session: Session,
    organization_id: UUID,
    work_order_ids: set[str],
) -> dict[str, str]:
    if not work_order_ids:
        return {}

    uuids = [UUID(work_order_id) for work_order_id in sorted(work_order_ids)]
    query = (
        select(WorkOrder.id, WorkOrder.title)
        .where(WorkOrder.organization_id == organization_id, WorkOrder.id.in_(uuids))
    )
    return {str(work_order_id): title for work_order_id, title in session.execute(query)}


def _assignment_changes(
    baseline_summary: PlanRunSummary,
    candidate_summary: PlanRunSummary,
    work_order_titles: dict[str, str],
) -> list[PlanRunAssignmentChange]:
    baseline_by_work_order = {
        assignment.work_order_id: assignment for assignment in baseline_summary.assignments
    }
    candidate_by_work_order = {
        assignment.work_order_id: assignment for assignment in candidate_summary.assignments
    }
    changes: list[PlanRunAssignmentChange] = []

    for work_order_id in sorted(set(baseline_by_work_order) | set(candidate_by_work_order)):
        baseline_assignment = baseline_by_work_order.get(work_order_id)
        candidate_assignment = candidate_by_work_order.get(work_order_id)

        if baseline_assignment is None and candidate_assignment is not None:
            changes.append(
                PlanRunAssignmentChange(
                    work_order_id=work_order_id,
                    work_order_title=work_order_titles.get(work_order_id),
                    change_type="added",
                    candidate_assignment=candidate_assignment,
                )
            )
            continue

        if baseline_assignment is not None and candidate_assignment is None:
            changes.append(
                PlanRunAssignmentChange(
                    work_order_id=work_order_id,
                    work_order_title=work_order_titles.get(work_order_id),
                    change_type="removed",
                    baseline_assignment=baseline_assignment,
                )
            )
            continue

        if baseline_assignment is None or candidate_assignment is None:
            continue

        changed_fields = _changed_assignment_fields(baseline_assignment, candidate_assignment)
        if changed_fields:
            changes.append(
                PlanRunAssignmentChange(
                    work_order_id=work_order_id,
                    work_order_title=work_order_titles.get(work_order_id),
                    change_type="modified",
                    changed_fields=changed_fields,
                    baseline_assignment=baseline_assignment,
                    candidate_assignment=candidate_assignment,
                )
            )

    return changes


def _changed_assignment_fields(
    baseline_assignment: CandidateAssignment,
    candidate_assignment: CandidateAssignment,
) -> list[str]:
    changed_fields: list[str] = []

    comparable_fields = [
        ("worker_id", baseline_assignment.worker_id, candidate_assignment.worker_id),
        ("worker_name", baseline_assignment.worker_name, candidate_assignment.worker_name),
        (
            "crew_worker_ids",
            sorted(baseline_assignment.crew_worker_ids),
            sorted(candidate_assignment.crew_worker_ids),
        ),
        (
            "crew_worker_names",
            sorted(baseline_assignment.crew_worker_names),
            sorted(candidate_assignment.crew_worker_names),
        ),
        (
            "crew_size_required",
            baseline_assignment.crew_size_required,
            candidate_assignment.crew_size_required,
        ),
        ("score", baseline_assignment.score, candidate_assignment.score),
        (
            "matched_skill_codes",
            sorted(baseline_assignment.matched_skill_codes),
            sorted(candidate_assignment.matched_skill_codes),
        ),
        (
            "matched_certification_codes",
            sorted(baseline_assignment.matched_certification_codes),
            sorted(candidate_assignment.matched_certification_codes),
        ),
        (
            "reserved_material_quantities",
            baseline_assignment.reserved_material_quantities,
            candidate_assignment.reserved_material_quantities,
        ),
        (
            "reserved_equipment_ids",
            sorted(baseline_assignment.reserved_equipment_ids),
            sorted(candidate_assignment.reserved_equipment_ids),
        ),
        (
            "scheduled_start_at",
            baseline_assignment.scheduled_start_at,
            candidate_assignment.scheduled_start_at,
        ),
        (
            "scheduled_end_at",
            baseline_assignment.scheduled_end_at,
            candidate_assignment.scheduled_end_at,
        ),
        (
            "estimated_travel_minutes",
            baseline_assignment.estimated_travel_minutes,
            candidate_assignment.estimated_travel_minutes,
        ),
        (
            "estimated_overtime_minutes",
            baseline_assignment.estimated_overtime_minutes,
            candidate_assignment.estimated_overtime_minutes,
        ),
    ]

    for field_name, baseline_value, candidate_value in comparable_fields:
        if baseline_value != candidate_value:
            changed_fields.append(field_name)

    return changed_fields


def _unassigned_changes(
    baseline_summary: PlanRunSummary,
    candidate_summary: PlanRunSummary,
    work_order_titles: dict[str, str],
) -> list[PlanRunUnassignedChange]:
    baseline_by_work_order = {
        item.work_order_id: item for item in baseline_summary.unassigned
    }
    candidate_by_work_order = {
        item.work_order_id: item for item in candidate_summary.unassigned
    }
    changes: list[PlanRunUnassignedChange] = []

    for work_order_id in sorted(set(baseline_by_work_order) | set(candidate_by_work_order)):
        baseline_item = baseline_by_work_order.get(work_order_id)
        candidate_item = candidate_by_work_order.get(work_order_id)

        if baseline_item is None and candidate_item is not None:
            changes.append(
                PlanRunUnassignedChange(
                    work_order_id=work_order_id,
                    work_order_title=work_order_titles.get(work_order_id),
                    change_type="added",
                    candidate_reason=candidate_item.reason,
                )
            )
            continue

        if baseline_item is not None and candidate_item is None:
            changes.append(
                PlanRunUnassignedChange(
                    work_order_id=work_order_id,
                    work_order_title=work_order_titles.get(work_order_id),
                    change_type="removed",
                    baseline_reason=baseline_item.reason,
                )
            )
            continue

        if baseline_item is None or candidate_item is None:
            continue

        if baseline_item.reason != candidate_item.reason:
            changes.append(
                PlanRunUnassignedChange(
                    work_order_id=work_order_id,
                    work_order_title=work_order_titles.get(work_order_id),
                    change_type="modified",
                    baseline_reason=baseline_item.reason,
                    candidate_reason=candidate_item.reason,
                )
            )

    return changes


def _issue_changes(
    baseline_summary: PlanRunSummary,
    candidate_summary: PlanRunSummary,
) -> list[PlanRunIssueChange]:
    baseline_issues = set(baseline_summary.issues)
    candidate_issues = set(candidate_summary.issues)
    changes: list[PlanRunIssueChange] = []

    for issue in sorted(candidate_issues - baseline_issues):
        changes.append(PlanRunIssueChange(message=issue, change_type="added"))

    for issue in sorted(baseline_issues - candidate_issues):
        changes.append(PlanRunIssueChange(message=issue, change_type="removed"))

    return changes


def build_organization_planning_request(
    session: Session,
    organization_id: UUID,
    payload: OrganizationPlanningRequest,
) -> tuple[PlanningRequest, list[str]]:
    _require_organization(session, organization_id)
    effective_window_start, effective_window_end = _resolve_planning_window(
        session,
        organization_id,
        payload,
    )
    effective_payload = payload.model_copy(
        update={
            "window_start": effective_window_start,
            "window_end": effective_window_end,
        }
    )

    workers = _load_workers(session, organization_id, effective_payload)
    materials = _load_materials(session, organization_id, effective_payload)
    equipment_units = _load_equipment_units(session, organization_id, effective_payload)
    work_orders, dependencies, issues = _load_work_orders(session, organization_id, effective_payload)

    return (
        PlanningRequest(
            scenario_name=payload.scenario_name,
            window_start=effective_window_start,
            window_end=effective_window_end,
            workers=workers,
            materials=materials,
            equipment_units=equipment_units,
            work_orders=work_orders,
            dependencies=dependencies,
        ),
        issues,
    )


def _load_workers(
    session: Session,
    organization_id: UUID,
    payload: OrganizationPlanningRequest,
) -> list[WorkerFact]:
    query = (
        select(Worker)
        .options(
            selectinload(Worker.worker_skills).selectinload(WorkerSkill.skill),
            selectinload(Worker.worker_certifications).selectinload(
                WorkerCertification.certification
            ),
            selectinload(Worker.availability_calendars).selectinload(AvailabilityCalendar.windows),
            selectinload(Worker.shift_templates).selectinload(WorkerShiftTemplate.break_rules),
            selectinload(Worker.home_location),
        )
        .where(Worker.organization_id == organization_id)
        .order_by(Worker.display_name.asc(), Worker.worker_code.asc())
    )

    if payload.worker_ids:
        query = query.where(Worker.id.in_(payload.worker_ids))
    if payload.worker_statuses:
        query = query.where(Worker.status.in_(payload.worker_statuses))
    if payload.location_ids:
        query = query.where(Worker.home_location_id.in_(payload.location_ids))
    if payload.planning_unit_ids:
        query = query.where(Worker.home_planning_unit_id.in_(payload.planning_unit_ids))

    reference_time = payload.window_start or datetime.now(UTC)
    workers = list(session.scalars(query))
    reserved_windows_by_worker = _load_active_worker_reservation_windows(
        session,
        organization_id,
        [worker.id for worker in workers],
        payload.window_start,
        payload.window_end,
    )
    worker_facts: list[WorkerFact] = []

    for worker in workers:
        skill_levels = {
            worker_skill.skill.code: worker_skill.proficiency_level
            for worker_skill in worker.worker_skills
            if worker_skill.skill.status == "active"
        }
        calendar_windows, has_active_calendars = _collect_availability_windows(
            worker,
            payload.window_start,
            payload.window_end,
        )
        (
            shift_windows,
            has_active_shift_templates,
            shift_regular_capacity_minutes,
        ) = _collect_shift_template_windows(
            worker,
            payload.window_start,
            payload.window_end,
        )
        availability_windows = _merge_worker_schedule_windows(calendar_windows, shift_windows)
        availability_windows.extend(reserved_windows_by_worker.get(worker.id, []))
        available = worker.status == "active"
        if (
            (has_active_calendars or has_active_shift_templates)
            and payload.window_start is not None
            and payload.window_end is not None
        ):
            available = available and any(
                window.availability_type == "available" for window in availability_windows
            )

        worker_facts.append(
            WorkerFact(
                worker_id=str(worker.id),
                display_name=worker.display_name,
                employment_type=worker.employment_type,
                daily_regular_capacity_minutes=_daily_regular_capacity_minutes(worker.employment_type),
                planning_regular_capacity_minutes=shift_regular_capacity_minutes
                if has_active_shift_templates
                else None,
                home_location_id=str(worker.home_location_id) if worker.home_location_id is not None else None,
                home_location_latitude=float(worker.home_location.latitude)
                if worker.home_location is not None and worker.home_location.latitude is not None
                else None,
                home_location_longitude=float(worker.home_location.longitude)
                if worker.home_location is not None and worker.home_location.longitude is not None
                else None,
                skill_codes=sorted(skill_levels),
                skill_levels=skill_levels,
                certification_codes=sorted(
                    {
                        worker_certification.certification.code
                        for worker_certification in worker.worker_certifications
                        if _certification_is_active(worker_certification, reference_time)
                    }
                ),
                available=available,
                availability_windows=availability_windows,
            )
        )

    return worker_facts


def _load_materials(
    session: Session,
    organization_id: UUID,
    payload: OrganizationPlanningRequest,
) -> list[MaterialAvailabilityFact]:
    query = (
        select(InventoryPosition)
        .options(selectinload(InventoryPosition.material))
        .join(Material)
        .where(Material.organization_id == organization_id, Material.status == "active")
        .order_by(InventoryPosition.created_at.asc())
    )
    if payload.location_ids:
        query = query.where(InventoryPosition.location_id.in_(payload.location_ids))

    return [
        MaterialAvailabilityFact(
            material_code=inventory_position.material.sku,
            location_id=str(inventory_position.location_id),
            available_quantity=max(
                0,
                inventory_position.on_hand_quantity - inventory_position.reserved_quantity,
            ),
        )
        for inventory_position in session.scalars(query)
    ]


def _load_equipment_units(
    session: Session,
    organization_id: UUID,
    payload: OrganizationPlanningRequest,
) -> list[EquipmentUnitFact]:
    query = (
        select(Equipment)
        .options(
            selectinload(Equipment.equipment_type),
            selectinload(Equipment.availability_calendars).selectinload(EquipmentAvailabilityCalendar.windows),
        )
        .where(Equipment.organization_id == organization_id)
        .order_by(Equipment.equipment_code.asc())
    )
    if payload.location_ids:
        query = query.where(Equipment.location_id.in_(payload.location_ids))

    equipment_records = list(session.scalars(query))
    reserved_windows_by_equipment = _load_active_equipment_reservation_windows(
        session,
        organization_id,
        [equipment.id for equipment in equipment_records],
        payload.window_start,
        payload.window_end,
    )
    equipment_units: list[EquipmentUnitFact] = []
    for equipment in equipment_records:
        availability_windows, has_active_calendars = _collect_availability_windows(
            equipment,
            payload.window_start,
            payload.window_end,
        )
        availability_windows.extend(reserved_windows_by_equipment.get(equipment.id, []))
        available = equipment.status == "active" and equipment.equipment_type.status == "active"
        if has_active_calendars and payload.window_start is not None and payload.window_end is not None:
            available = available and any(
                window.availability_type == "available" for window in availability_windows
            )

        equipment_units.append(
            EquipmentUnitFact(
                equipment_id=str(equipment.id),
                equipment_type_code=equipment.equipment_type.code,
                location_id=str(equipment.location_id),
                available=available,
                availability_windows=availability_windows,
            )
        )

    return equipment_units


def _load_active_worker_reservation_windows(
    session: Session,
    organization_id: UUID,
    worker_ids: list[UUID],
    window_start: datetime | None,
    window_end: datetime | None,
) -> dict[UUID, list[AvailabilityWindowFact]]:
    if not worker_ids:
        return {}

    reservations = list(
        session.scalars(
            select(PlanWorkerReservation).where(
                PlanWorkerReservation.organization_id == organization_id,
                PlanWorkerReservation.worker_id.in_(worker_ids),
                PlanWorkerReservation.status == "active",
            )
        )
    )
    windows_by_worker: dict[UUID, list[AvailabilityWindowFact]] = {}
    for reservation in reservations:
        if not _reservation_matches_window(
            reservation.reserved_start_at,
            reservation.reserved_end_at,
            window_start,
            window_end,
        ):
            continue
        windows_by_worker.setdefault(reservation.worker_id, []).append(
            AvailabilityWindowFact(
                start_at=_reservation_bound_start(
                    reservation.reserved_start_at,
                    window_start,
                ),
                end_at=_reservation_bound_end(
                    reservation.reserved_end_at,
                    window_end,
                ),
                availability_type="unavailable",
            )
        )
    return windows_by_worker


def _load_active_equipment_reservation_windows(
    session: Session,
    organization_id: UUID,
    equipment_ids: list[UUID],
    window_start: datetime | None,
    window_end: datetime | None,
) -> dict[UUID, list[AvailabilityWindowFact]]:
    if not equipment_ids:
        return {}

    reservations = list(
        session.scalars(
            select(PlanEquipmentReservation).where(
                PlanEquipmentReservation.organization_id == organization_id,
                PlanEquipmentReservation.equipment_id.in_(equipment_ids),
                PlanEquipmentReservation.status == "active",
            )
        )
    )
    windows_by_equipment: dict[UUID, list[AvailabilityWindowFact]] = {}
    for reservation in reservations:
        if not _reservation_matches_window(
            reservation.reserved_start_at,
            reservation.reserved_end_at,
            window_start,
            window_end,
        ):
            continue
        windows_by_equipment.setdefault(reservation.equipment_id, []).append(
            AvailabilityWindowFact(
                start_at=_reservation_bound_start(
                    reservation.reserved_start_at,
                    window_start,
                ),
                end_at=_reservation_bound_end(
                    reservation.reserved_end_at,
                    window_end,
                ),
                availability_type="unavailable",
            )
        )
    return windows_by_equipment


def _load_work_orders(
    session: Session,
    organization_id: UUID,
    payload: OrganizationPlanningRequest,
) -> tuple[list[WorkOrderFact], list[WorkOrderDependencyFact], list[str]]:
    query = (
        select(WorkOrder)
        .options(selectinload(WorkOrder.requirements), selectinload(WorkOrder.location))
        .where(WorkOrder.organization_id == organization_id)
        .order_by(WorkOrder.priority.desc(), WorkOrder.created_at.asc())
    )

    if payload.work_order_ids:
        query = query.where(WorkOrder.id.in_(payload.work_order_ids))
    if payload.work_order_statuses:
        query = query.where(WorkOrder.status.in_(payload.work_order_statuses))
    if payload.location_ids:
        query = query.where(WorkOrder.location_id.in_(payload.location_ids))
    if payload.planning_unit_ids:
        query = query.where(WorkOrder.planning_unit_id.in_(payload.planning_unit_ids))

    work_orders = list(session.scalars(query))
    skill_codes_by_id = {
        skill.id: skill.code
        for skill in session.scalars(
            select(Skill).where(Skill.organization_id == organization_id, Skill.status == "active")
        )
    }
    certification_codes_by_id = {
        certification.id: certification.code
        for certification in session.scalars(
            select(Certification).where(
                Certification.organization_id == organization_id,
                Certification.status == "active",
            )
        )
    }
    material_codes_by_id = {
        material.id: material.sku
        for material in session.scalars(
            select(Material).where(Material.organization_id == organization_id, Material.status == "active")
        )
    }
    equipment_type_codes_by_id = {
        equipment_type.id: equipment_type.code
        for equipment_type in session.scalars(
            select(EquipmentType).where(
                EquipmentType.organization_id == organization_id,
                EquipmentType.status == "active",
            )
        )
    }

    issues: list[str] = []
    work_order_facts: list[WorkOrderFact] = []

    for work_order in work_orders:
        if not _work_order_matches_window(work_order, payload.window_start, payload.window_end):
            continue

        required_skill_codes: list[str] = []
        required_skill_quantities: dict[str, int] = {}
        required_skill_levels: dict[str, int] = {}
        required_certification_codes: list[str] = []
        required_certification_quantities: dict[str, int] = {}
        required_material_quantities: dict[str, int] = {}
        required_equipment_type_quantities: dict[str, int] = {}

        for requirement in work_order.requirements:
            if requirement.requirement_type == "skill":
                if requirement.reference_id is None:
                    issues.append(
                        f"Work order {work_order.id} has a skill requirement without a referenced skill."
                    )
                    continue
                skill_code = skill_codes_by_id.get(requirement.reference_id)
                if skill_code is None:
                    issues.append(
                        f"Work order {work_order.id} references a missing or inactive skill {requirement.reference_id}."
                    )
                    continue
                required_skill_codes.append(skill_code)
                required_skill_quantities[skill_code] = (
                    required_skill_quantities.get(skill_code, 0) + max(requirement.quantity, 1)
                )
                required_skill_levels[skill_code] = max(
                    required_skill_levels.get(skill_code, 1),
                    requirement.min_level or 1,
                )
                continue

            if requirement.requirement_type == "certification":
                if requirement.reference_id is None:
                    issues.append(
                        "Work order "
                        f"{work_order.id} has a certification requirement without a referenced certification."
                    )
                    continue
                certification_code = certification_codes_by_id.get(requirement.reference_id)
                if certification_code is None:
                    issues.append(
                        "Work order "
                        f"{work_order.id} references a missing or inactive certification {requirement.reference_id}."
                    )
                    continue
                required_certification_codes.append(certification_code)
                required_certification_quantities[certification_code] = (
                    required_certification_quantities.get(certification_code, 0)
                    + max(requirement.quantity, 1)
                )
                continue

            if requirement.requirement_type == "material":
                if requirement.reference_id is None:
                    issues.append(
                        f"Work order {work_order.id} has a material requirement without a referenced material."
                    )
                    continue
                material_code = material_codes_by_id.get(requirement.reference_id)
                if material_code is None:
                    issues.append(
                        f"Work order {work_order.id} references a missing or inactive material {requirement.reference_id}."
                    )
                    continue
                required_material_quantities[material_code] = (
                    required_material_quantities.get(material_code, 0) + requirement.quantity
                )
                continue

            if requirement.requirement_type == "equipment_type":
                if requirement.reference_id is None:
                    issues.append(
                        "Work order "
                        f"{work_order.id} has an equipment type requirement without a referenced equipment type."
                    )
                    continue
                equipment_type_code = equipment_type_codes_by_id.get(requirement.reference_id)
                if equipment_type_code is None:
                    issues.append(
                        "Work order "
                        f"{work_order.id} references a missing or inactive equipment type {requirement.reference_id}."
                    )
                    continue
                required_equipment_type_quantities[equipment_type_code] = (
                    required_equipment_type_quantities.get(equipment_type_code, 0) + requirement.quantity
                )
                continue

            issues.append(
                f"Work order {work_order.id} includes unsupported requirement type "
                f"'{requirement.requirement_type}' for the stub planner."
            )

        work_order_facts.append(
            WorkOrderFact(
                work_order_id=str(work_order.id),
                title=work_order.title,
                location_id=str(work_order.location_id),
                required_skill_codes=sorted(set(required_skill_codes)),
                required_skill_quantities=required_skill_quantities,
                required_skill_levels=required_skill_levels,
                required_certification_codes=sorted(set(required_certification_codes)),
                required_certification_quantities=required_certification_quantities,
                required_worker_count=max(
                    [1, *required_skill_quantities.values(), *required_certification_quantities.values()]
                ),
                required_material_quantities=required_material_quantities,
                required_equipment_type_quantities=required_equipment_type_quantities,
                priority=work_order.priority,
                requested_start_at=work_order.requested_start_at,
                due_at=work_order.due_at,
                location_latitude=float(work_order.location.latitude)
                if work_order.location is not None and work_order.location.latitude is not None
                else None,
                location_longitude=float(work_order.location.longitude)
                if work_order.location is not None and work_order.location.longitude is not None
                else None,
            )
        )

    selected_work_order_ids = [UUID(work_order.work_order_id) for work_order in work_order_facts]
    dependencies: list[WorkOrderDependencyFact] = []
    if selected_work_order_ids:
        dependencies = [
            WorkOrderDependencyFact(
                predecessor_work_order_id=str(dependency.predecessor_work_order_id),
                successor_work_order_id=str(dependency.successor_work_order_id),
                dependency_type=dependency.dependency_type,
            )
            for dependency in session.scalars(
                select(WorkOrderDependency).where(
                    WorkOrderDependency.predecessor_work_order_id.in_(selected_work_order_ids),
                    WorkOrderDependency.successor_work_order_id.in_(selected_work_order_ids),
                )
            )
        ]

    return work_order_facts, dependencies, issues


def _require_organization(session: Session, organization_id: UUID) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise NotFoundError(f"Organization {organization_id} was not found.")
    return organization


def _validate_planning_window(window_start: datetime | None, window_end: datetime | None) -> None:
    if window_start is not None and window_end is not None and window_end < window_start:
        raise ValidationError("window_end must be greater than or equal to window_start.")


def _resolve_planning_window(
    session: Session,
    organization_id: UUID,
    payload: OrganizationPlanningRequest,
) -> tuple[datetime | None, datetime | None]:
    window_start = payload.window_start
    window_end = payload.window_end
    if payload.planning_horizon_id is not None:
        horizon = get_planning_horizon(session, organization_id, payload.planning_horizon_id)
        horizon_start = _as_utc(horizon.start_at)
        horizon_end = _as_utc(horizon.end_at)
        if window_start is not None and _as_utc(window_start) < horizon_start:
            raise ValidationError(
                "window_start cannot be earlier than the selected planning horizon start."
            )
        if window_end is not None and _as_utc(window_end) > horizon_end:
            raise ValidationError(
                "window_end cannot be later than the selected planning horizon end."
            )
        window_start = window_start or _as_utc(horizon.start_at)
        window_end = window_end or _as_utc(horizon.end_at)
    _validate_planning_window(window_start, window_end)
    return window_start, window_end


def _collect_availability_windows(
    worker,
    window_start: datetime | None,
    window_end: datetime | None,
) -> tuple[list[AvailabilityWindowFact], bool]:
    windows: list[AvailabilityWindowFact] = []
    active_calendars = [
        calendar
        for calendar in worker.availability_calendars
        if calendar.status == "active" and _calendar_matches_window(calendar, window_start, window_end)
    ]

    for calendar in active_calendars:
        for window in calendar.windows:
            if (
                window_start is not None
                and window_end is not None
                and not _intervals_overlap(window.start_at, window.end_at, window_start, window_end)
            ):
                continue
            windows.append(
                AvailabilityWindowFact(
                    start_at=window.start_at,
                    end_at=window.end_at,
                    availability_type=window.availability_type,
                )
            )

    return windows, bool(active_calendars)


def _collect_shift_template_windows(
    worker: Worker,
    window_start: datetime | None,
    window_end: datetime | None,
) -> tuple[list[AvailabilityWindowFact], bool, int]:
    active_shift_templates = [
        template for template in worker.shift_templates if template.status == "active"
    ]
    if not active_shift_templates:
        return [], False, 0
    if window_start is None or window_end is None:
        return [], True, 0

    window_start_utc = _as_utc(window_start)
    window_end_utc = _as_utc(window_end)
    windows: list[AvailabilityWindowFact] = []
    regular_capacity_minutes = 0

    for shift_template in active_shift_templates:
        timezone_name = shift_template.timezone or "UTC"
        try:
            timezone = ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            timezone = ZoneInfo("UTC")

        local_start_date = window_start_utc.astimezone(timezone).date() - timedelta(days=1)
        local_end_date = window_end_utc.astimezone(timezone).date() + timedelta(days=1)

        for local_day in _date_range(local_start_date, local_end_date):
            if local_day.weekday() != shift_template.day_of_week:
                continue

            shift_start_local = datetime.combine(local_day, time.min, tzinfo=timezone) + timedelta(
                minutes=shift_template.start_minute_local
            )
            shift_end_local = datetime.combine(local_day, time.min, tzinfo=timezone) + timedelta(
                minutes=shift_template.end_minute_local
            )
            if shift_template.end_minute_local <= shift_template.start_minute_local:
                shift_end_local += timedelta(days=1)

            shift_start_utc = _as_utc(shift_start_local)
            shift_end_utc = _as_utc(shift_end_local)
            if not _intervals_overlap(shift_start_utc, shift_end_utc, window_start_utc, window_end_utc):
                continue
            if not _shift_template_matches_interval(
                shift_template,
                shift_start_utc,
                shift_end_utc,
            ):
                continue

            clipped_shift = _clip_interval(
                shift_start_utc,
                shift_end_utc,
                window_start_utc,
                window_end_utc,
            )
            if clipped_shift is None:
                continue

            shift_break_windows: list[AvailabilityWindowFact] = []
            for break_rule in shift_template.break_rules:
                if break_rule.status != "active":
                    continue
                break_start_local = datetime.combine(local_day, time.min, tzinfo=timezone) + timedelta(
                    minutes=break_rule.start_minute_local
                )
                if (
                    shift_template.end_minute_local <= shift_template.start_minute_local
                    and break_rule.start_minute_local < shift_template.start_minute_local
                ):
                    break_start_local += timedelta(days=1)
                break_end_local = break_start_local + timedelta(minutes=break_rule.duration_minutes)
                break_start_utc = _as_utc(break_start_local)
                break_end_utc = _as_utc(break_end_local)
                if not _intervals_overlap(
                    break_start_utc,
                    break_end_utc,
                    clipped_shift[0],
                    clipped_shift[1],
                ):
                    continue
                clipped_break = _clip_interval(
                    break_start_utc,
                    break_end_utc,
                    clipped_shift[0],
                    clipped_shift[1],
                )
                if clipped_break is None:
                    continue
                shift_break_windows.append(
                    AvailabilityWindowFact(
                        start_at=clipped_break[0],
                        end_at=clipped_break[1],
                        availability_type="unavailable",
                    )
                )

            break_minutes = sum(
                _interval_minutes(window.start_at, window.end_at)
                for window in shift_break_windows
            )
            regular_capacity_minutes += max(
                0,
                _interval_minutes(clipped_shift[0], clipped_shift[1]) - break_minutes,
            )

            windows.append(
                AvailabilityWindowFact(
                    start_at=clipped_shift[0],
                    end_at=clipped_shift[1],
                    availability_type="available",
                )
            )
            windows.extend(shift_break_windows)

    return windows, True, regular_capacity_minutes


def _merge_worker_schedule_windows(
    calendar_windows: list[AvailabilityWindowFact],
    shift_template_windows: list[AvailabilityWindowFact],
) -> list[AvailabilityWindowFact]:
    if not shift_template_windows:
        return calendar_windows

    shift_available = [
        window for window in shift_template_windows if window.availability_type == "available"
    ]
    shift_unavailable = [
        window for window in shift_template_windows if window.availability_type != "available"
    ]
    calendar_available = [
        window for window in calendar_windows if window.availability_type == "available"
    ]
    calendar_unavailable = [
        window for window in calendar_windows if window.availability_type != "available"
    ]

    merged_available = (
        _intersect_windows(shift_available, calendar_available)
        if calendar_available
        else shift_available
    )
    return [*merged_available, *shift_unavailable, *calendar_unavailable]


def _intersect_windows(
    left_windows: list[AvailabilityWindowFact],
    right_windows: list[AvailabilityWindowFact],
) -> list[AvailabilityWindowFact]:
    intersections: list[AvailabilityWindowFact] = []
    for left_window in left_windows:
        for right_window in right_windows:
            if not _intervals_overlap(
                left_window.start_at,
                left_window.end_at,
                right_window.start_at,
                right_window.end_at,
            ):
                continue
            clipped = _clip_interval(
                left_window.start_at,
                left_window.end_at,
                right_window.start_at,
                right_window.end_at,
            )
            if clipped is None:
                continue
            intersections.append(
                AvailabilityWindowFact(
                    start_at=clipped[0],
                    end_at=clipped[1],
                    availability_type="available",
                )
            )
    return intersections


def _date_range(start_day: date, end_day: date) -> list[date]:
    days: list[date] = []
    cursor = start_day
    while cursor <= end_day:
        days.append(cursor)
        cursor += timedelta(days=1)
    return days


def _clip_interval(
    interval_start: datetime,
    interval_end: datetime,
    clip_start: datetime,
    clip_end: datetime,
) -> tuple[datetime, datetime] | None:
    start_at = max(_as_utc(interval_start), _as_utc(clip_start))
    end_at = min(_as_utc(interval_end), _as_utc(clip_end))
    if end_at <= start_at:
        return None
    return start_at, end_at


def _interval_minutes(start_at: datetime, end_at: datetime) -> int:
    return int((_as_utc(end_at) - _as_utc(start_at)).total_seconds() // 60)


def _shift_template_matches_interval(
    shift_template: WorkerShiftTemplate,
    interval_start: datetime,
    interval_end: datetime,
) -> bool:
    effective_start = shift_template.effective_from or datetime.min.replace(tzinfo=UTC)
    effective_end = shift_template.effective_to or datetime.max.replace(tzinfo=UTC)
    return _intervals_overlap(effective_start, effective_end, interval_start, interval_end)


def _calendar_matches_window(
    calendar,
    window_start: datetime | None,
    window_end: datetime | None,
) -> bool:
    if window_start is None or window_end is None:
        return True

    calendar_start = calendar.effective_from or datetime.min.replace(tzinfo=UTC)
    calendar_end = calendar.effective_to or datetime.max.replace(tzinfo=UTC)
    return _intervals_overlap(calendar_start, calendar_end, window_start, window_end)


def _reservation_matches_window(
    reserved_start_at: datetime | None,
    reserved_end_at: datetime | None,
    window_start: datetime | None,
    window_end: datetime | None,
) -> bool:
    if window_start is None or window_end is None:
        return True
    if reserved_start_at is None or reserved_end_at is None:
        return True
    return _intervals_overlap(reserved_start_at, reserved_end_at, window_start, window_end)


def _reservation_bound_start(
    reserved_start_at: datetime | None,
    window_start: datetime | None,
) -> datetime:
    if reserved_start_at is not None:
        return _as_utc(reserved_start_at)
    if window_start is not None:
        return _as_utc(window_start)
    return datetime.min.replace(tzinfo=UTC)


def _reservation_bound_end(
    reserved_end_at: datetime | None,
    window_end: datetime | None,
) -> datetime:
    if reserved_end_at is not None:
        return _as_utc(reserved_end_at)
    if window_end is not None:
        return _as_utc(window_end)
    return datetime.max.replace(tzinfo=UTC)


def _work_order_matches_window(
    work_order: WorkOrder,
    window_start: datetime | None,
    window_end: datetime | None,
) -> bool:
    if window_start is None or window_end is None:
        return True
    if work_order.requested_start_at is None and work_order.due_at is None:
        return True

    interval_start = work_order.requested_start_at or work_order.due_at
    interval_end = work_order.due_at or work_order.requested_start_at
    if interval_start is None or interval_end is None:
        return True
    return _intervals_overlap(interval_start, interval_end, window_start, window_end)


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
    return left_start <= right_end and right_start <= left_end


def _certification_is_active(
    worker_certification: WorkerCertification,
    reference_time: datetime,
) -> bool:
    reference_time = _as_utc(reference_time)
    if worker_certification.status != "active":
        return False
    if worker_certification.certification.status != "active":
        return False
    if worker_certification.expires_at is not None and _as_utc(worker_certification.expires_at) < reference_time:
        return False
    return True


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _duration_minutes(
    start_at: datetime | None,
    end_at: datetime | None,
) -> int | None:
    if start_at is None or end_at is None:
        return None
    return int((_as_utc(end_at) - _as_utc(start_at)).total_seconds() // 60)


def _variance_minutes(
    planned_at: datetime | None,
    actual_at: datetime | None,
) -> int | None:
    if planned_at is None or actual_at is None:
        return None
    return int((_as_utc(actual_at) - _as_utc(planned_at)).total_seconds() // 60)


def _work_type_label(work_order: WorkOrder) -> str:
    if work_order.service_level_policy is not None:
        return work_order.service_level_policy.name
    if work_order.planning_unit is not None:
        return work_order.planning_unit.name
    return "General work"


def _build_actuals_breakdown(
    items: list[PlanActualsReviewItem],
    label_for: Callable[[PlanActualsReviewItem], str],
) -> list[PlanActualsBreakdownItem]:
    grouped: dict[str, list[PlanActualsReviewItem]] = {}
    for item in items:
        label = str(label_for(item))
        grouped.setdefault(label, []).append(item)

    breakdown: list[PlanActualsBreakdownItem] = []
    for label, grouped_items in sorted(grouped.items(), key=lambda item: item[0]):
        breakdown.append(
            PlanActualsBreakdownItem(
                label=label,
                assignments_total=len(grouped_items),
                assignments_completed=sum(
                    1 for item in grouped_items if item.execution_status == "completed"
                ),
                assignments_in_progress=sum(
                    1 for item in grouped_items if item.execution_status == "in_progress"
                ),
                assignments_blocked=sum(
                    1 for item in grouped_items if item.execution_status == "blocked"
                ),
                assignments_not_started=sum(
                    1
                    for item in grouped_items
                    if item.execution_status == "not_started"
                    and item.assignment_status != "cancelled"
                ),
                assignments_cancelled=sum(
                    1 for item in grouped_items if item.assignment_status == "cancelled"
                ),
                delayed_start_count=sum(
                    1
                    for item in grouped_items
                    if item.start_variance_minutes is not None and item.start_variance_minutes > 0
                ),
                overdue_completion_count=sum(
                    1
                    for item in grouped_items
                    if item.completion_variance_minutes is not None
                    and item.completion_variance_minutes > 0
                ),
                blocked_event_count=sum(item.blocked_event_count for item in grouped_items),
                total_duration_variance_minutes=sum(
                    item.duration_variance_minutes or 0 for item in grouped_items
                ),
            )
        )
    return breakdown
