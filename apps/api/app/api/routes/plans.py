from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from zenith_planner.planner import generate_stub_plan
from zenith_schemas.planning import (
    OperationsReportFilters,
    OperationsReportRead,
    OrganizationPlanningRequest,
    PlanActualsReviewRead,
    PlanAssignmentBulkHandoffAction,
    PlanAssignmentBulkHandoffResult,
    PlanAssignmentCancellationAction,
    PlanAssignmentEventCreate,
    PlanAssignmentEventRead,
    PlanAssignmentOverrideUpdate,
    PlanAssignmentRead,
    PlanAssignmentReassignmentAction,
    PlanDispatchQueueApplyAction,
    PlanDispatchQueueApplyResult,
    PlanDispatchQueueCreate,
    PlanDispatchQueueRead,
    PlanDispatchQueueTemplateCreate,
    PlanDispatchQueueTemplateRead,
    PlanDispatchQueueTemplateUpdate,
    PlanDispatchQueueUpdate,
    PlanningHorizonCreate,
    PlanningHorizonRead,
    PlanningHorizonUpdate,
    PlanningRequest,
    PlanRunApprovalAction,
    PlanRunComparisonRead,
    PlanRunCreate,
    PlanRunPublishAction,
    PlanRunRead,
    PlanRunSummary,
    PlanScenarioCreate,
    PlanScenarioRead,
    PlanScenarioUpdate,
)

from app.api.dependencies import db_session_dependency
from app.services.planning_service import (
    apply_dispatch_queue_action,
    apply_dispatch_queue_template_action,
    approve_plan_run,
    bulk_update_plan_assignment_handoff,
    cancel_published_assignment,
    clone_plan_scenario,
    compare_plan_runs,
    create_plan_assignment_event,
    create_plan_dispatch_queue,
    create_plan_dispatch_queue_template,
    create_plan_run,
    create_plan_scenario,
    create_planning_horizon,
    delete_plan_dispatch_queue,
    delete_plan_dispatch_queue_template,
    delete_plan_run,
    delete_plan_scenario,
    delete_planning_horizon,
    export_operations_report_csv,
    generate_organization_stub_plan,
    get_latest_plan_run,
    get_operations_report,
    get_plan_actuals_review,
    get_plan_dispatch_queue,
    get_plan_dispatch_queue_template,
    get_plan_run,
    get_plan_scenario,
    get_planning_horizon,
    list_dispatch_queue_assignments,
    list_dispatch_queue_template_assignments,
    list_plan_assignment_events,
    list_plan_assignments,
    list_plan_dispatch_queue_templates,
    list_plan_dispatch_queues,
    list_plan_runs,
    list_plan_scenarios,
    list_planning_horizons,
    override_plan_assignment,
    publish_plan_run,
    reassign_published_assignment,
    rerun_plan_run,
    save_plan_run_as_scenario,
    update_plan_dispatch_queue,
    update_plan_dispatch_queue_template,
    update_plan_scenario,
    update_planning_horizon,
)

router = APIRouter()
DBSession = Annotated[Session, Depends(db_session_dependency)]


@router.post("/plans/dry-run", response_model=PlanRunSummary)
def dry_run_plan(request: PlanningRequest) -> PlanRunSummary:
    # This dry-run endpoint exists to validate the new API -> planner -> schemas flow.
    return generate_stub_plan(request)


@router.post("/organizations/{organization_id}/plans/dry-run", response_model=PlanRunSummary)
def dry_run_organization_plan(
    organization_id: UUID,
    request: OrganizationPlanningRequest,
    session: DBSession,
) -> PlanRunSummary:
    return generate_organization_stub_plan(session, organization_id, request)


@router.get(
    "/organizations/{organization_id}/planning-horizons",
    response_model=list[PlanningHorizonRead],
)
def planning_horizons_index(
    organization_id: UUID,
    session: DBSession,
) -> list[PlanningHorizonRead]:
    return list_planning_horizons(session, organization_id)


@router.post(
    "/organizations/{organization_id}/planning-horizons",
    response_model=PlanningHorizonRead,
    status_code=status.HTTP_201_CREATED,
)
def planning_horizons_create(
    organization_id: UUID,
    payload: PlanningHorizonCreate,
    session: DBSession,
) -> PlanningHorizonRead:
    return create_planning_horizon(session, organization_id, payload)


@router.get(
    "/organizations/{organization_id}/planning-horizons/{horizon_id}",
    response_model=PlanningHorizonRead,
)
def planning_horizons_get(
    organization_id: UUID,
    horizon_id: UUID,
    session: DBSession,
) -> PlanningHorizonRead:
    return get_planning_horizon(session, organization_id, horizon_id)


@router.patch(
    "/organizations/{organization_id}/planning-horizons/{horizon_id}",
    response_model=PlanningHorizonRead,
)
def planning_horizons_update(
    organization_id: UUID,
    horizon_id: UUID,
    payload: PlanningHorizonUpdate,
    session: DBSession,
) -> PlanningHorizonRead:
    return update_planning_horizon(session, organization_id, horizon_id, payload)


@router.delete(
    "/organizations/{organization_id}/planning-horizons/{horizon_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def planning_horizons_delete(
    organization_id: UUID,
    horizon_id: UUID,
    session: DBSession,
) -> Response:
    delete_planning_horizon(session, organization_id, horizon_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/organizations/{organization_id}/plan-scenarios", response_model=list[PlanScenarioRead])
def plan_scenarios_index(
    organization_id: UUID,
    session: DBSession,
) -> list[PlanScenarioRead]:
    return list_plan_scenarios(session, organization_id)


@router.post(
    "/organizations/{organization_id}/plan-scenarios",
    response_model=PlanScenarioRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_scenarios_create(
    organization_id: UUID,
    payload: PlanScenarioCreate,
    session: DBSession,
) -> PlanScenarioRead:
    return create_plan_scenario(session, organization_id, payload)


@router.post(
    "/organizations/{organization_id}/plan-scenarios/{scenario_id}/clone",
    response_model=PlanScenarioRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_scenarios_clone(
    organization_id: UUID,
    scenario_id: UUID,
    session: DBSession,
) -> PlanScenarioRead:
    return clone_plan_scenario(session, organization_id, scenario_id)


@router.get("/organizations/{organization_id}/plan-scenarios/{scenario_id}", response_model=PlanScenarioRead)
def plan_scenarios_get(
    organization_id: UUID,
    scenario_id: UUID,
    session: DBSession,
) -> PlanScenarioRead:
    return get_plan_scenario(session, organization_id, scenario_id)


@router.patch("/organizations/{organization_id}/plan-scenarios/{scenario_id}", response_model=PlanScenarioRead)
def plan_scenarios_update(
    organization_id: UUID,
    scenario_id: UUID,
    payload: PlanScenarioUpdate,
    session: DBSession,
) -> PlanScenarioRead:
    return update_plan_scenario(session, organization_id, scenario_id, payload)


@router.delete(
    "/organizations/{organization_id}/plan-scenarios/{scenario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def plan_scenarios_delete(
    organization_id: UUID,
    scenario_id: UUID,
    session: DBSession,
) -> Response:
    delete_plan_scenario(session, organization_id, scenario_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/organizations/{organization_id}/plan-runs", response_model=list[PlanRunRead])
def plan_runs_index(organization_id: UUID, session: DBSession) -> list[PlanRunRead]:
    return list_plan_runs(session, organization_id)


@router.post(
    "/organizations/{organization_id}/plan-runs",
    response_model=PlanRunRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_runs_create(
    organization_id: UUID,
    payload: PlanRunCreate,
    session: DBSession,
) -> PlanRunRead:
    return create_plan_run(session, organization_id, payload)


@router.get(
    "/organizations/{organization_id}/plan-runs/{run_id}/assignments",
    response_model=list[PlanAssignmentRead],
)
def plan_assignments_index(
    organization_id: UUID,
    run_id: UUID,
    session: DBSession,
) -> list[PlanAssignmentRead]:
    return list_plan_assignments(session, organization_id, run_id)


@router.get(
    "/organizations/{organization_id}/dispatch-queue-templates",
    response_model=list[PlanDispatchQueueTemplateRead],
)
def plan_dispatch_queue_templates_index(
    organization_id: UUID,
    session: DBSession,
) -> list[PlanDispatchQueueTemplateRead]:
    return list_plan_dispatch_queue_templates(session, organization_id)


@router.post(
    "/organizations/{organization_id}/dispatch-queue-templates",
    response_model=PlanDispatchQueueTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_dispatch_queue_templates_create(
    organization_id: UUID,
    payload: PlanDispatchQueueTemplateCreate,
    session: DBSession,
) -> PlanDispatchQueueTemplateRead:
    return create_plan_dispatch_queue_template(session, organization_id, payload)


@router.get(
    "/organizations/{organization_id}/dispatch-queue-templates/{template_id}",
    response_model=PlanDispatchQueueTemplateRead,
)
def plan_dispatch_queue_templates_get(
    organization_id: UUID,
    template_id: UUID,
    session: DBSession,
) -> PlanDispatchQueueTemplateRead:
    return get_plan_dispatch_queue_template(session, organization_id, template_id)


@router.patch(
    "/organizations/{organization_id}/dispatch-queue-templates/{template_id}",
    response_model=PlanDispatchQueueTemplateRead,
)
def plan_dispatch_queue_templates_update(
    organization_id: UUID,
    template_id: UUID,
    payload: PlanDispatchQueueTemplateUpdate,
    session: DBSession,
) -> PlanDispatchQueueTemplateRead:
    return update_plan_dispatch_queue_template(session, organization_id, template_id, payload)


@router.delete(
    "/organizations/{organization_id}/dispatch-queue-templates/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def plan_dispatch_queue_templates_delete(
    organization_id: UUID,
    template_id: UUID,
    session: DBSession,
) -> Response:
    delete_plan_dispatch_queue_template(session, organization_id, template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queues",
    response_model=list[PlanDispatchQueueRead],
)
def plan_dispatch_queues_index(
    organization_id: UUID,
    run_id: UUID,
    session: DBSession,
) -> list[PlanDispatchQueueRead]:
    return list_plan_dispatch_queues(session, organization_id, run_id)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queues",
    response_model=PlanDispatchQueueRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_dispatch_queues_create(
    organization_id: UUID,
    run_id: UUID,
    payload: PlanDispatchQueueCreate,
    session: DBSession,
) -> PlanDispatchQueueRead:
    return create_plan_dispatch_queue(session, organization_id, run_id, payload)


@router.get(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queues/{queue_id}",
    response_model=PlanDispatchQueueRead,
)
def plan_dispatch_queues_get(
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
    session: DBSession,
) -> PlanDispatchQueueRead:
    return get_plan_dispatch_queue(session, organization_id, run_id, queue_id)


@router.patch(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queues/{queue_id}",
    response_model=PlanDispatchQueueRead,
)
def plan_dispatch_queues_update(
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
    payload: PlanDispatchQueueUpdate,
    session: DBSession,
) -> PlanDispatchQueueRead:
    return update_plan_dispatch_queue(session, organization_id, run_id, queue_id, payload)


@router.delete(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queues/{queue_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def plan_dispatch_queues_delete(
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
    session: DBSession,
) -> Response:
    delete_plan_dispatch_queue(session, organization_id, run_id, queue_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queues/{queue_id}/assignments",
    response_model=list[PlanAssignmentRead],
)
def plan_dispatch_queues_assignments(
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
    session: DBSession,
) -> list[PlanAssignmentRead]:
    return list_dispatch_queue_assignments(session, organization_id, run_id, queue_id)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queues/{queue_id}/apply-action",
    response_model=PlanDispatchQueueApplyResult,
)
def plan_dispatch_queues_apply_action(
    organization_id: UUID,
    run_id: UUID,
    queue_id: UUID,
    payload: PlanDispatchQueueApplyAction,
    session: DBSession,
) -> PlanDispatchQueueApplyResult:
    return apply_dispatch_queue_action(session, organization_id, run_id, queue_id, payload)


@router.get(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queue-templates/{template_id}/assignments",
    response_model=list[PlanAssignmentRead],
)
def plan_dispatch_queue_template_assignments(
    organization_id: UUID,
    run_id: UUID,
    template_id: UUID,
    session: DBSession,
) -> list[PlanAssignmentRead]:
    return list_dispatch_queue_template_assignments(session, organization_id, run_id, template_id)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/dispatch-queue-templates/{template_id}/apply-action",
    response_model=PlanDispatchQueueApplyResult,
)
def plan_dispatch_queue_template_apply_action(
    organization_id: UUID,
    run_id: UUID,
    template_id: UUID,
    payload: PlanDispatchQueueApplyAction,
    session: DBSession,
) -> PlanDispatchQueueApplyResult:
    return apply_dispatch_queue_template_action(
        session,
        organization_id,
        run_id,
        template_id,
        payload,
    )


@router.get(
    "/organizations/{organization_id}/plan-runs/{run_id}/assignments/{assignment_id}/events",
    response_model=list[PlanAssignmentEventRead],
)
def plan_assignment_events_index(
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    session: DBSession,
) -> list[PlanAssignmentEventRead]:
    return list_plan_assignment_events(session, organization_id, run_id, assignment_id)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/assignments/{assignment_id}/events",
    response_model=PlanAssignmentEventRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_assignment_events_create(
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentEventCreate,
    session: DBSession,
) -> PlanAssignmentEventRead:
    return create_plan_assignment_event(session, organization_id, run_id, assignment_id, payload)


@router.patch(
    "/organizations/{organization_id}/plan-runs/{run_id}/assignments/{assignment_id}",
    response_model=PlanAssignmentRead,
)
def plan_assignments_override(
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentOverrideUpdate,
    session: DBSession,
) -> PlanAssignmentRead:
    return override_plan_assignment(session, organization_id, run_id, assignment_id, payload)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/assignments/{assignment_id}/reassign",
    response_model=PlanAssignmentRead,
)
def plan_assignments_reassign_published(
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentReassignmentAction,
    session: DBSession,
) -> PlanAssignmentRead:
    return reassign_published_assignment(session, organization_id, run_id, assignment_id, payload)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/assignments/handoff",
    response_model=PlanAssignmentBulkHandoffResult,
)
def plan_assignments_bulk_handoff_update(
    organization_id: UUID,
    run_id: UUID,
    payload: PlanAssignmentBulkHandoffAction,
    session: DBSession,
) -> PlanAssignmentBulkHandoffResult:
    return bulk_update_plan_assignment_handoff(session, organization_id, run_id, payload)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/assignments/{assignment_id}/cancel",
    response_model=PlanAssignmentRead,
)
def plan_assignments_cancel_published(
    organization_id: UUID,
    run_id: UUID,
    assignment_id: UUID,
    payload: PlanAssignmentCancellationAction,
    session: DBSession,
) -> PlanAssignmentRead:
    return cancel_published_assignment(session, organization_id, run_id, assignment_id, payload)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/rerun",
    response_model=PlanRunRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_runs_rerun(
    organization_id: UUID,
    run_id: UUID,
    session: DBSession,
) -> PlanRunRead:
    return rerun_plan_run(session, organization_id, run_id)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/approve",
    response_model=PlanRunRead,
)
def plan_runs_approve(
    organization_id: UUID,
    run_id: UUID,
    payload: PlanRunApprovalAction,
    session: DBSession,
) -> PlanRunRead:
    return approve_plan_run(session, organization_id, run_id, payload)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/publish",
    response_model=PlanRunRead,
)
def plan_runs_publish(
    organization_id: UUID,
    run_id: UUID,
    payload: PlanRunPublishAction,
    session: DBSession,
) -> PlanRunRead:
    return publish_plan_run(session, organization_id, run_id, payload)


@router.post(
    "/organizations/{organization_id}/plan-runs/{run_id}/save-scenario",
    response_model=PlanScenarioRead,
    status_code=status.HTTP_201_CREATED,
)
def plan_runs_save_scenario(
    organization_id: UUID,
    run_id: UUID,
    session: DBSession,
) -> PlanScenarioRead:
    return save_plan_run_as_scenario(session, organization_id, run_id)


@router.get("/organizations/{organization_id}/plan-runs/latest", response_model=PlanRunRead)
def plan_runs_latest(organization_id: UUID, session: DBSession) -> PlanRunRead:
    return get_latest_plan_run(session, organization_id)


@router.get(
    "/organizations/{organization_id}/plan-runs/{run_id}/actuals-review",
    response_model=PlanActualsReviewRead,
)
def plan_runs_actuals_review(
    organization_id: UUID,
    run_id: UUID,
    session: DBSession,
) -> PlanActualsReviewRead:
    return get_plan_actuals_review(session, organization_id, run_id)


@router.get(
    "/organizations/{organization_id}/reports/operations",
    response_model=OperationsReportRead,
)
def operations_report_get(
    organization_id: UUID,
    session: DBSession,
    window_start: datetime | None = Query(default=None),
    window_end: datetime | None = Query(default=None),
    location_id: UUID | None = Query(default=None),
    planning_unit_id: UUID | None = Query(default=None),
) -> OperationsReportRead:
    return get_operations_report(
        session,
        organization_id,
        OperationsReportFilters(
            window_start=window_start,
            window_end=window_end,
            location_id=location_id,
            planning_unit_id=planning_unit_id,
        ),
    )


@router.get("/organizations/{organization_id}/reports/operations/export.csv")
def operations_report_export_csv(
    organization_id: UUID,
    session: DBSession,
    window_start: datetime | None = Query(default=None),
    window_end: datetime | None = Query(default=None),
    location_id: UUID | None = Query(default=None),
    planning_unit_id: UUID | None = Query(default=None),
) -> Response:
    csv_content = export_operations_report_csv(
        session,
        organization_id,
        OperationsReportFilters(
            window_start=window_start,
            window_end=window_end,
            location_id=location_id,
            planning_unit_id=planning_unit_id,
        ),
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": 'attachment; filename="operations-report.csv"',
        },
    )


@router.get("/organizations/{organization_id}/plan-runs/compare", response_model=PlanRunComparisonRead)
def plan_runs_compare(
    organization_id: UUID,
    baseline_run_id: UUID,
    candidate_run_id: UUID,
    session: DBSession,
) -> PlanRunComparisonRead:
    return compare_plan_runs(session, organization_id, baseline_run_id, candidate_run_id)


@router.get("/organizations/{organization_id}/plan-runs/{run_id}", response_model=PlanRunRead)
def plan_runs_get(
    organization_id: UUID,
    run_id: UUID,
    session: DBSession,
) -> PlanRunRead:
    return get_plan_run(session, organization_id, run_id)


@router.delete(
    "/organizations/{organization_id}/plan-runs/{run_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def plan_runs_delete(
    organization_id: UUID,
    run_id: UUID,
    session: DBSession,
) -> Response:
    delete_plan_run(session, organization_id, run_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
