from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from zenith_schemas.workforce import (
    AvailabilityCalendarCreate,
    AvailabilityCalendarRead,
    AvailabilityCalendarUpdate,
    AvailabilityWindowCreate,
    AvailabilityWindowRead,
    AvailabilityWindowUpdate,
    CertificationCreate,
    CertificationRead,
    CertificationUpdate,
    SkillCreate,
    SkillRead,
    SkillUpdate,
    WorkerCertificationCreate,
    WorkerCertificationRead,
    WorkerCertificationUpdate,
    WorkerCreate,
    WorkerRead,
    WorkerShiftBreakRuleCreate,
    WorkerShiftBreakRuleRead,
    WorkerShiftBreakRuleUpdate,
    WorkerShiftTemplateCreate,
    WorkerShiftTemplateRead,
    WorkerShiftTemplateUpdate,
    WorkerSkillCreate,
    WorkerSkillRead,
    WorkerSkillUpdate,
    WorkerUpdate,
)

from app.api.dependencies import db_session_dependency
from app.services.workforce_service import (
    create_availability_calendar,
    create_availability_window,
    create_certification,
    create_skill,
    create_worker,
    create_worker_certification,
    create_worker_shift_break_rule,
    create_worker_shift_template,
    create_worker_skill,
    delete_availability_calendar,
    delete_availability_window,
    delete_certification,
    delete_skill,
    delete_worker,
    delete_worker_certification,
    delete_worker_shift_break_rule,
    delete_worker_shift_template,
    delete_worker_skill,
    get_availability_calendar,
    get_certification,
    get_skill,
    get_worker,
    get_worker_shift_break_rule,
    get_worker_shift_template,
    list_availability_calendars,
    list_availability_windows,
    list_certifications,
    list_skills,
    list_worker_certifications,
    list_worker_shift_break_rules,
    list_worker_shift_templates,
    list_worker_skills,
    list_workers,
    update_availability_calendar,
    update_availability_window,
    update_certification,
    update_skill,
    update_worker,
    update_worker_certification,
    update_worker_shift_break_rule,
    update_worker_shift_template,
    update_worker_skill,
)

router = APIRouter(prefix="/organizations/{organization_id}")
DBSession = Annotated[Session, Depends(db_session_dependency)]


@router.get("/skills", response_model=list[SkillRead])
def skills_index(organization_id: UUID, session: DBSession) -> list[SkillRead]:
    return list_skills(session, organization_id)


@router.post("/skills", response_model=SkillRead, status_code=status.HTTP_201_CREATED)
def skills_create(organization_id: UUID, payload: SkillCreate, session: DBSession) -> SkillRead:
    return create_skill(session, organization_id, payload)


@router.get("/skills/{skill_id}", response_model=SkillRead)
def skills_get(organization_id: UUID, skill_id: UUID, session: DBSession) -> SkillRead:
    return get_skill(session, organization_id, skill_id)


@router.patch("/skills/{skill_id}", response_model=SkillRead)
def skills_update(
    organization_id: UUID, skill_id: UUID, payload: SkillUpdate, session: DBSession
) -> SkillRead:
    return update_skill(session, organization_id, skill_id, payload)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def skills_delete(organization_id: UUID, skill_id: UUID, session: DBSession) -> Response:
    delete_skill(session, organization_id, skill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/certifications", response_model=list[CertificationRead])
def certifications_index(organization_id: UUID, session: DBSession) -> list[CertificationRead]:
    return list_certifications(session, organization_id)


@router.post(
    "/certifications",
    response_model=CertificationRead,
    status_code=status.HTTP_201_CREATED,
)
def certifications_create(
    organization_id: UUID, payload: CertificationCreate, session: DBSession
) -> CertificationRead:
    return create_certification(session, organization_id, payload)


@router.get("/certifications/{certification_id}", response_model=CertificationRead)
def certifications_get(
    organization_id: UUID, certification_id: UUID, session: DBSession
) -> CertificationRead:
    return get_certification(session, organization_id, certification_id)


@router.patch("/certifications/{certification_id}", response_model=CertificationRead)
def certifications_update(
    organization_id: UUID,
    certification_id: UUID,
    payload: CertificationUpdate,
    session: DBSession,
) -> CertificationRead:
    return update_certification(session, organization_id, certification_id, payload)


@router.delete("/certifications/{certification_id}", status_code=status.HTTP_204_NO_CONTENT)
def certifications_delete(
    organization_id: UUID,
    certification_id: UUID,
    session: DBSession,
) -> Response:
    delete_certification(session, organization_id, certification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/workers", response_model=list[WorkerRead])
def workers_index(organization_id: UUID, session: DBSession) -> list[WorkerRead]:
    return list_workers(session, organization_id)


@router.post("/workers", response_model=WorkerRead, status_code=status.HTTP_201_CREATED)
def workers_create(organization_id: UUID, payload: WorkerCreate, session: DBSession) -> WorkerRead:
    return create_worker(session, organization_id, payload)


@router.get("/workers/{worker_id}", response_model=WorkerRead)
def workers_get(organization_id: UUID, worker_id: UUID, session: DBSession) -> WorkerRead:
    return get_worker(session, organization_id, worker_id)


@router.patch("/workers/{worker_id}", response_model=WorkerRead)
def workers_update(
    organization_id: UUID,
    worker_id: UUID,
    payload: WorkerUpdate,
    session: DBSession,
) -> WorkerRead:
    return update_worker(session, organization_id, worker_id, payload)


@router.delete("/workers/{worker_id}", status_code=status.HTTP_204_NO_CONTENT)
def workers_delete(organization_id: UUID, worker_id: UUID, session: DBSession) -> Response:
    delete_worker(session, organization_id, worker_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/workers/{worker_id}/skills", response_model=list[WorkerSkillRead])
def worker_skills_index(
    organization_id: UUID, worker_id: UUID, session: DBSession
) -> list[WorkerSkillRead]:
    return list_worker_skills(session, organization_id, worker_id)


@router.post(
    "/workers/{worker_id}/skills",
    response_model=WorkerSkillRead,
    status_code=status.HTTP_201_CREATED,
)
def worker_skills_create(
    organization_id: UUID,
    worker_id: UUID,
    payload: WorkerSkillCreate,
    session: DBSession,
) -> WorkerSkillRead:
    return create_worker_skill(session, organization_id, worker_id, payload)


@router.patch("/workers/{worker_id}/skills/{worker_skill_id}", response_model=WorkerSkillRead)
def worker_skills_update(
    organization_id: UUID,
    worker_id: UUID,
    worker_skill_id: UUID,
    payload: WorkerSkillUpdate,
    session: DBSession,
) -> WorkerSkillRead:
    return update_worker_skill(session, organization_id, worker_id, worker_skill_id, payload)


@router.delete("/workers/{worker_id}/skills/{worker_skill_id}", status_code=status.HTTP_204_NO_CONTENT)
def worker_skills_delete(
    organization_id: UUID,
    worker_id: UUID,
    worker_skill_id: UUID,
    session: DBSession,
) -> Response:
    delete_worker_skill(session, organization_id, worker_id, worker_skill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/workers/{worker_id}/certifications", response_model=list[WorkerCertificationRead])
def worker_certifications_index(
    organization_id: UUID,
    worker_id: UUID,
    session: DBSession,
) -> list[WorkerCertificationRead]:
    return list_worker_certifications(session, organization_id, worker_id)


@router.post(
    "/workers/{worker_id}/certifications",
    response_model=WorkerCertificationRead,
    status_code=status.HTTP_201_CREATED,
)
def worker_certifications_create(
    organization_id: UUID,
    worker_id: UUID,
    payload: WorkerCertificationCreate,
    session: DBSession,
) -> WorkerCertificationRead:
    return create_worker_certification(session, organization_id, worker_id, payload)


@router.patch(
    "/workers/{worker_id}/certifications/{worker_certification_id}",
    response_model=WorkerCertificationRead,
)
def worker_certifications_update(
    organization_id: UUID,
    worker_id: UUID,
    worker_certification_id: UUID,
    payload: WorkerCertificationUpdate,
    session: DBSession,
) -> WorkerCertificationRead:
    return update_worker_certification(
        session,
        organization_id,
        worker_id,
        worker_certification_id,
        payload,
    )


@router.delete(
    "/workers/{worker_id}/certifications/{worker_certification_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def worker_certifications_delete(
    organization_id: UUID,
    worker_id: UUID,
    worker_certification_id: UUID,
    session: DBSession,
) -> Response:
    delete_worker_certification(session, organization_id, worker_id, worker_certification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/workers/{worker_id}/availability-calendars", response_model=list[AvailabilityCalendarRead])
def availability_calendars_index(
    organization_id: UUID,
    worker_id: UUID,
    session: DBSession,
) -> list[AvailabilityCalendarRead]:
    return list_availability_calendars(session, organization_id, worker_id)


@router.post(
    "/workers/{worker_id}/availability-calendars",
    response_model=AvailabilityCalendarRead,
    status_code=status.HTTP_201_CREATED,
)
def availability_calendars_create(
    organization_id: UUID,
    worker_id: UUID,
    payload: AvailabilityCalendarCreate,
    session: DBSession,
) -> AvailabilityCalendarRead:
    return create_availability_calendar(session, organization_id, worker_id, payload)


@router.get(
    "/workers/{worker_id}/availability-calendars/{calendar_id}",
    response_model=AvailabilityCalendarRead,
)
def availability_calendars_get(
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    session: DBSession,
) -> AvailabilityCalendarRead:
    return get_availability_calendar(session, organization_id, worker_id, calendar_id)


@router.patch(
    "/workers/{worker_id}/availability-calendars/{calendar_id}",
    response_model=AvailabilityCalendarRead,
)
def availability_calendars_update(
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    payload: AvailabilityCalendarUpdate,
    session: DBSession,
) -> AvailabilityCalendarRead:
    return update_availability_calendar(session, organization_id, worker_id, calendar_id, payload)


@router.delete(
    "/workers/{worker_id}/availability-calendars/{calendar_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def availability_calendars_delete(
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    session: DBSession,
) -> Response:
    delete_availability_calendar(session, organization_id, worker_id, calendar_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/workers/{worker_id}/availability-calendars/{calendar_id}/windows",
    response_model=list[AvailabilityWindowRead],
)
def availability_windows_index(
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    session: DBSession,
) -> list[AvailabilityWindowRead]:
    return list_availability_windows(session, organization_id, worker_id, calendar_id)


@router.post(
    "/workers/{worker_id}/availability-calendars/{calendar_id}/windows",
    response_model=AvailabilityWindowRead,
    status_code=status.HTTP_201_CREATED,
)
def availability_windows_create(
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    payload: AvailabilityWindowCreate,
    session: DBSession,
) -> AvailabilityWindowRead:
    return create_availability_window(session, organization_id, worker_id, calendar_id, payload)


@router.patch(
    "/workers/{worker_id}/availability-calendars/{calendar_id}/windows/{window_id}",
    response_model=AvailabilityWindowRead,
)
def availability_windows_update(
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
    payload: AvailabilityWindowUpdate,
    session: DBSession,
) -> AvailabilityWindowRead:
    return update_availability_window(
        session,
        organization_id,
        worker_id,
        calendar_id,
        window_id,
        payload,
    )


@router.delete(
    "/workers/{worker_id}/availability-calendars/{calendar_id}/windows/{window_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def availability_windows_delete(
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
    session: DBSession,
) -> Response:
    delete_availability_window(session, organization_id, worker_id, calendar_id, window_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/workers/{worker_id}/shift-templates",
    response_model=list[WorkerShiftTemplateRead],
)
def worker_shift_templates_index(
    organization_id: UUID,
    worker_id: UUID,
    session: DBSession,
) -> list[WorkerShiftTemplateRead]:
    return list_worker_shift_templates(session, organization_id, worker_id)


@router.post(
    "/workers/{worker_id}/shift-templates",
    response_model=WorkerShiftTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def worker_shift_templates_create(
    organization_id: UUID,
    worker_id: UUID,
    payload: WorkerShiftTemplateCreate,
    session: DBSession,
) -> WorkerShiftTemplateRead:
    return create_worker_shift_template(session, organization_id, worker_id, payload)


@router.get(
    "/workers/{worker_id}/shift-templates/{shift_template_id}",
    response_model=WorkerShiftTemplateRead,
)
def worker_shift_templates_get(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    session: DBSession,
) -> WorkerShiftTemplateRead:
    return get_worker_shift_template(session, organization_id, worker_id, shift_template_id)


@router.patch(
    "/workers/{worker_id}/shift-templates/{shift_template_id}",
    response_model=WorkerShiftTemplateRead,
)
def worker_shift_templates_update(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    payload: WorkerShiftTemplateUpdate,
    session: DBSession,
) -> WorkerShiftTemplateRead:
    return update_worker_shift_template(
        session,
        organization_id,
        worker_id,
        shift_template_id,
        payload,
    )


@router.delete(
    "/workers/{worker_id}/shift-templates/{shift_template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def worker_shift_templates_delete(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    session: DBSession,
) -> Response:
    delete_worker_shift_template(session, organization_id, worker_id, shift_template_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/workers/{worker_id}/shift-templates/{shift_template_id}/break-rules",
    response_model=list[WorkerShiftBreakRuleRead],
)
def worker_shift_break_rules_index(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    session: DBSession,
) -> list[WorkerShiftBreakRuleRead]:
    return list_worker_shift_break_rules(session, organization_id, worker_id, shift_template_id)


@router.post(
    "/workers/{worker_id}/shift-templates/{shift_template_id}/break-rules",
    response_model=WorkerShiftBreakRuleRead,
    status_code=status.HTTP_201_CREATED,
)
def worker_shift_break_rules_create(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    payload: WorkerShiftBreakRuleCreate,
    session: DBSession,
) -> WorkerShiftBreakRuleRead:
    return create_worker_shift_break_rule(
        session,
        organization_id,
        worker_id,
        shift_template_id,
        payload,
    )


@router.get(
    "/workers/{worker_id}/shift-templates/{shift_template_id}/break-rules/{break_rule_id}",
    response_model=WorkerShiftBreakRuleRead,
)
def worker_shift_break_rules_get(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    break_rule_id: UUID,
    session: DBSession,
) -> WorkerShiftBreakRuleRead:
    return get_worker_shift_break_rule(
        session,
        organization_id,
        worker_id,
        shift_template_id,
        break_rule_id,
    )


@router.patch(
    "/workers/{worker_id}/shift-templates/{shift_template_id}/break-rules/{break_rule_id}",
    response_model=WorkerShiftBreakRuleRead,
)
def worker_shift_break_rules_update(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    break_rule_id: UUID,
    payload: WorkerShiftBreakRuleUpdate,
    session: DBSession,
) -> WorkerShiftBreakRuleRead:
    return update_worker_shift_break_rule(
        session,
        organization_id,
        worker_id,
        shift_template_id,
        break_rule_id,
        payload,
    )


@router.delete(
    "/workers/{worker_id}/shift-templates/{shift_template_id}/break-rules/{break_rule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def worker_shift_break_rules_delete(
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    break_rule_id: UUID,
    session: DBSession,
) -> Response:
    delete_worker_shift_break_rule(
        session,
        organization_id,
        worker_id,
        shift_template_id,
        break_rule_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
