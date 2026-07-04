from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload
from zenith_schemas.workforce import (
    AvailabilityCalendarCreate,
    AvailabilityCalendarUpdate,
    AvailabilityWindowCreate,
    AvailabilityWindowUpdate,
    CertificationCreate,
    CertificationUpdate,
    SkillCreate,
    SkillUpdate,
    WorkerCertificationCreate,
    WorkerCertificationUpdate,
    WorkerCreate,
    WorkerShiftBreakRuleCreate,
    WorkerShiftBreakRuleUpdate,
    WorkerShiftTemplateCreate,
    WorkerShiftTemplateUpdate,
    WorkerSkillCreate,
    WorkerSkillUpdate,
    WorkerUpdate,
)

from app.db.models.demand import WorkRequirement
from app.db.models.organization import Location, Organization, PlanningUnit
from app.db.models.workforce import (
    AvailabilityCalendar,
    AvailabilityWindow,
    Certification,
    Skill,
    Worker,
    WorkerCertification,
    WorkerShiftBreakRule,
    WorkerShiftTemplate,
    WorkerSkill,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError


def list_skills(session: Session, organization_id: UUID) -> list[Skill]:
    _require_organization(session, organization_id)
    query = select(Skill).where(Skill.organization_id == organization_id).order_by(Skill.name.asc())
    return list(session.scalars(query))


def create_skill(session: Session, organization_id: UUID, payload: SkillCreate) -> Skill:
    _require_organization(session, organization_id)
    _ensure_unique_skill_code(session, organization_id, payload.code)
    skill = Skill(organization_id=organization_id, **payload.model_dump())
    session.add(skill)
    session.commit()
    session.refresh(skill)
    return skill


def get_skill(session: Session, organization_id: UUID, skill_id: UUID) -> Skill:
    skill = session.get(Skill, skill_id)
    if skill is None or skill.organization_id != organization_id:
        raise NotFoundError(f"Skill {skill_id} was not found in organization {organization_id}.")
    return skill


def update_skill(session: Session, organization_id: UUID, skill_id: UUID, payload: SkillUpdate) -> Skill:
    skill = get_skill(session, organization_id, skill_id)
    updates = payload.model_dump(exclude_unset=True)
    if "code" in updates and updates["code"] != skill.code:
        _ensure_unique_skill_code(session, organization_id, updates["code"], exclude_id=skill_id)
    for field, value in updates.items():
        setattr(skill, field, value)
    session.commit()
    session.refresh(skill)
    return skill


def delete_skill(session: Session, organization_id: UUID, skill_id: UUID) -> None:
    skill = get_skill(session, organization_id, skill_id)
    if skill.worker_skills:
        raise ConflictError("Cannot delete a skill that is still assigned to workers.")
    requirement_query = select(WorkRequirement).where(
        WorkRequirement.requirement_type == "skill",
        WorkRequirement.reference_id == skill_id,
    )
    if session.scalar(requirement_query) is not None:
        raise ConflictError("Cannot delete a skill that is still referenced by work requirements.")
    session.delete(skill)
    session.commit()


def list_certifications(session: Session, organization_id: UUID) -> list[Certification]:
    _require_organization(session, organization_id)
    query = (
        select(Certification)
        .where(Certification.organization_id == organization_id)
        .order_by(Certification.name.asc())
    )
    return list(session.scalars(query))


def create_certification(
    session: Session, organization_id: UUID, payload: CertificationCreate
) -> Certification:
    _require_organization(session, organization_id)
    _ensure_unique_certification_code(session, organization_id, payload.code)
    certification = Certification(organization_id=organization_id, **payload.model_dump())
    session.add(certification)
    session.commit()
    session.refresh(certification)
    return certification


def get_certification(session: Session, organization_id: UUID, certification_id: UUID) -> Certification:
    certification = session.get(Certification, certification_id)
    if certification is None or certification.organization_id != organization_id:
        raise NotFoundError(
            f"Certification {certification_id} was not found in organization {organization_id}."
        )
    return certification


def update_certification(
    session: Session,
    organization_id: UUID,
    certification_id: UUID,
    payload: CertificationUpdate,
) -> Certification:
    certification = get_certification(session, organization_id, certification_id)
    updates = payload.model_dump(exclude_unset=True)
    if "code" in updates and updates["code"] != certification.code:
        _ensure_unique_certification_code(
            session,
            organization_id,
            updates["code"],
            exclude_id=certification_id,
        )
    for field, value in updates.items():
        setattr(certification, field, value)
    session.commit()
    session.refresh(certification)
    return certification


def delete_certification(session: Session, organization_id: UUID, certification_id: UUID) -> None:
    certification = get_certification(session, organization_id, certification_id)
    if certification.worker_certifications:
        raise ConflictError("Cannot delete a certification that is still assigned to workers.")
    requirement_query = select(WorkRequirement).where(
        WorkRequirement.requirement_type == "certification",
        WorkRequirement.reference_id == certification_id,
    )
    if session.scalar(requirement_query) is not None:
        raise ConflictError(
            "Cannot delete a certification that is still referenced by work requirements."
        )
    session.delete(certification)
    session.commit()


def list_workers(session: Session, organization_id: UUID) -> list[Worker]:
    _require_organization(session, organization_id)
    query = (
        select(Worker)
        .where(Worker.organization_id == organization_id)
        .order_by(Worker.display_name.asc())
    )
    return list(session.scalars(query))


def create_worker(session: Session, organization_id: UUID, payload: WorkerCreate) -> Worker:
    _require_organization(session, organization_id)
    _ensure_unique_worker_code(session, organization_id, payload.worker_code)
    _validate_worker_home_refs(
        session,
        organization_id,
        payload.home_location_id,
        payload.home_planning_unit_id,
    )
    worker = Worker(organization_id=organization_id, **payload.model_dump())
    session.add(worker)
    session.commit()
    session.refresh(worker)
    return worker


def get_worker(session: Session, organization_id: UUID, worker_id: UUID) -> Worker:
    worker = session.get(Worker, worker_id)
    if worker is None or worker.organization_id != organization_id:
        raise NotFoundError(f"Worker {worker_id} was not found in organization {organization_id}.")
    return worker


def update_worker(session: Session, organization_id: UUID, worker_id: UUID, payload: WorkerUpdate) -> Worker:
    worker = get_worker(session, organization_id, worker_id)
    updates = payload.model_dump(exclude_unset=True)
    if "worker_code" in updates and updates["worker_code"] != worker.worker_code:
        _ensure_unique_worker_code(session, organization_id, updates["worker_code"], exclude_id=worker_id)

    home_location_id = updates.get("home_location_id", worker.home_location_id)
    home_planning_unit_id = updates.get("home_planning_unit_id", worker.home_planning_unit_id)
    if "home_location_id" in updates or "home_planning_unit_id" in updates:
        _validate_worker_home_refs(session, organization_id, home_location_id, home_planning_unit_id)

    for field, value in updates.items():
        setattr(worker, field, value)
    session.commit()
    session.refresh(worker)
    return worker


def delete_worker(session: Session, organization_id: UUID, worker_id: UUID) -> None:
    worker = get_worker(session, organization_id, worker_id)
    session.delete(worker)
    session.commit()


def list_worker_skills(session: Session, organization_id: UUID, worker_id: UUID) -> list[WorkerSkill]:
    get_worker(session, organization_id, worker_id)
    query = (
        select(WorkerSkill)
        .options(selectinload(WorkerSkill.skill))
        .where(WorkerSkill.worker_id == worker_id)
        .order_by(WorkerSkill.created_at.asc())
    )
    return list(session.scalars(query))


def create_worker_skill(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    payload: WorkerSkillCreate,
) -> WorkerSkill:
    get_worker(session, organization_id, worker_id)
    _ensure_skill_belongs_to_org(session, organization_id, payload.skill_id)
    _ensure_unique_worker_skill(session, worker_id, payload.skill_id)
    worker_skill = WorkerSkill(worker_id=worker_id, **payload.model_dump())
    session.add(worker_skill)
    session.commit()
    return get_worker_skill(session, organization_id, worker_id, worker_skill.id)


def get_worker_skill(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    worker_skill_id: UUID,
) -> WorkerSkill:
    get_worker(session, organization_id, worker_id)
    query = (
        select(WorkerSkill)
        .options(selectinload(WorkerSkill.skill))
        .where(WorkerSkill.id == worker_skill_id, WorkerSkill.worker_id == worker_id)
    )
    worker_skill = session.scalar(query)
    if worker_skill is None:
        raise NotFoundError(f"Worker skill {worker_skill_id} was not found for worker {worker_id}.")
    return worker_skill


def update_worker_skill(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    worker_skill_id: UUID,
    payload: WorkerSkillUpdate,
) -> WorkerSkill:
    worker_skill = get_worker_skill(session, organization_id, worker_id, worker_skill_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(worker_skill, field, value)
    session.commit()
    return get_worker_skill(session, organization_id, worker_id, worker_skill_id)


def delete_worker_skill(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    worker_skill_id: UUID,
) -> None:
    worker_skill = get_worker_skill(session, organization_id, worker_id, worker_skill_id)
    session.delete(worker_skill)
    session.commit()


def list_worker_certifications(
    session: Session, organization_id: UUID, worker_id: UUID
) -> list[WorkerCertification]:
    get_worker(session, organization_id, worker_id)
    query = (
        select(WorkerCertification)
        .options(selectinload(WorkerCertification.certification))
        .where(WorkerCertification.worker_id == worker_id)
        .order_by(WorkerCertification.created_at.asc())
    )
    return list(session.scalars(query))


def create_worker_certification(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    payload: WorkerCertificationCreate,
) -> WorkerCertification:
    get_worker(session, organization_id, worker_id)
    _ensure_certification_belongs_to_org(session, organization_id, payload.certification_id)
    _ensure_unique_worker_certification(session, worker_id, payload.certification_id)
    _validate_certification_dates(payload.issued_at, payload.expires_at)
    worker_certification = WorkerCertification(worker_id=worker_id, **payload.model_dump())
    session.add(worker_certification)
    session.commit()
    return get_worker_certification(session, organization_id, worker_id, worker_certification.id)


def get_worker_certification(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    worker_certification_id: UUID,
) -> WorkerCertification:
    get_worker(session, organization_id, worker_id)
    query = (
        select(WorkerCertification)
        .options(selectinload(WorkerCertification.certification))
        .where(
            WorkerCertification.id == worker_certification_id,
            WorkerCertification.worker_id == worker_id,
        )
    )
    worker_certification = session.scalar(query)
    if worker_certification is None:
        raise NotFoundError(
            f"Worker certification {worker_certification_id} was not found for worker {worker_id}."
        )
    return worker_certification


def update_worker_certification(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    worker_certification_id: UUID,
    payload: WorkerCertificationUpdate,
) -> WorkerCertification:
    worker_certification = get_worker_certification(
        session,
        organization_id,
        worker_id,
        worker_certification_id,
    )
    updates = payload.model_dump(exclude_unset=True)
    _validate_certification_dates(
        updates.get("issued_at", worker_certification.issued_at),
        updates.get("expires_at", worker_certification.expires_at),
    )
    for field, value in updates.items():
        setattr(worker_certification, field, value)
    session.commit()
    return get_worker_certification(session, organization_id, worker_id, worker_certification_id)


def delete_worker_certification(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    worker_certification_id: UUID,
) -> None:
    worker_certification = get_worker_certification(
        session,
        organization_id,
        worker_id,
        worker_certification_id,
    )
    session.delete(worker_certification)
    session.commit()


def list_availability_calendars(
    session: Session, organization_id: UUID, worker_id: UUID
) -> list[AvailabilityCalendar]:
    get_worker(session, organization_id, worker_id)
    query = (
        select(AvailabilityCalendar)
        .where(AvailabilityCalendar.worker_id == worker_id)
        .order_by(AvailabilityCalendar.created_at.asc())
    )
    return list(session.scalars(query))


def create_availability_calendar(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    payload: AvailabilityCalendarCreate,
) -> AvailabilityCalendar:
    get_worker(session, organization_id, worker_id)
    _validate_effective_range(payload.effective_from, payload.effective_to)
    calendar = AvailabilityCalendar(worker_id=worker_id, **payload.model_dump())
    session.add(calendar)
    session.commit()
    session.refresh(calendar)
    return calendar


def get_availability_calendar(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
) -> AvailabilityCalendar:
    get_worker(session, organization_id, worker_id)
    calendar = session.get(AvailabilityCalendar, calendar_id)
    if calendar is None or calendar.worker_id != worker_id:
        raise NotFoundError(f"Availability calendar {calendar_id} was not found for worker {worker_id}.")
    return calendar


def update_availability_calendar(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    payload: AvailabilityCalendarUpdate,
) -> AvailabilityCalendar:
    calendar = get_availability_calendar(session, organization_id, worker_id, calendar_id)
    updates = payload.model_dump(exclude_unset=True)
    _validate_effective_range(
        updates.get("effective_from", calendar.effective_from),
        updates.get("effective_to", calendar.effective_to),
    )
    for field, value in updates.items():
        setattr(calendar, field, value)
    session.commit()
    session.refresh(calendar)
    return calendar


def delete_availability_calendar(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
) -> None:
    calendar = get_availability_calendar(session, organization_id, worker_id, calendar_id)
    session.delete(calendar)
    session.commit()


def list_availability_windows(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
) -> list[AvailabilityWindow]:
    get_availability_calendar(session, organization_id, worker_id, calendar_id)
    query = (
        select(AvailabilityWindow)
        .where(AvailabilityWindow.calendar_id == calendar_id)
        .order_by(AvailabilityWindow.start_at.asc())
    )
    return list(session.scalars(query))


def create_availability_window(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    payload: AvailabilityWindowCreate,
) -> AvailabilityWindow:
    get_availability_calendar(session, organization_id, worker_id, calendar_id)
    _validate_window_range(payload.start_at, payload.end_at)
    window = AvailabilityWindow(calendar_id=calendar_id, **payload.model_dump())
    session.add(window)
    session.commit()
    session.refresh(window)
    return window


def get_availability_window(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
) -> AvailabilityWindow:
    get_availability_calendar(session, organization_id, worker_id, calendar_id)
    window = session.get(AvailabilityWindow, window_id)
    if window is None or window.calendar_id != calendar_id:
        raise NotFoundError(
            f"Availability window {window_id} was not found for calendar {calendar_id}."
        )
    return window


def update_availability_window(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
    payload: AvailabilityWindowUpdate,
) -> AvailabilityWindow:
    window = get_availability_window(session, organization_id, worker_id, calendar_id, window_id)
    updates = payload.model_dump(exclude_unset=True)
    _validate_window_range(
        updates.get("start_at", window.start_at),
        updates.get("end_at", window.end_at),
    )
    for field, value in updates.items():
        setattr(window, field, value)
    session.commit()
    session.refresh(window)
    return window


def delete_availability_window(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
) -> None:
    window = get_availability_window(session, organization_id, worker_id, calendar_id, window_id)
    session.delete(window)
    session.commit()


def list_worker_shift_templates(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
) -> list[WorkerShiftTemplate]:
    get_worker(session, organization_id, worker_id)
    query = (
        select(WorkerShiftTemplate)
        .options(selectinload(WorkerShiftTemplate.break_rules))
        .where(WorkerShiftTemplate.worker_id == worker_id)
        .order_by(
            WorkerShiftTemplate.day_of_week.asc(),
            WorkerShiftTemplate.start_minute_local.asc(),
            WorkerShiftTemplate.name.asc(),
        )
    )
    return list(session.scalars(query))


def create_worker_shift_template(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    payload: WorkerShiftTemplateCreate,
) -> WorkerShiftTemplate:
    get_worker(session, organization_id, worker_id)
    _validate_shift_minutes(payload.start_minute_local, payload.end_minute_local)
    _validate_effective_range(payload.effective_from, payload.effective_to)
    _ensure_unique_worker_shift_template(
        session,
        worker_id,
        payload.name,
        payload.day_of_week,
    )
    created_at = datetime.now(UTC)
    shift_template = WorkerShiftTemplate(
        worker_id=worker_id,
        created_at=created_at,
        updated_at=created_at,
        **payload.model_dump(),
    )
    session.add(shift_template)
    session.commit()
    return get_worker_shift_template(session, organization_id, worker_id, shift_template.id)


def get_worker_shift_template(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
) -> WorkerShiftTemplate:
    get_worker(session, organization_id, worker_id)
    query = (
        select(WorkerShiftTemplate)
        .options(selectinload(WorkerShiftTemplate.break_rules))
        .where(
            WorkerShiftTemplate.id == shift_template_id,
            WorkerShiftTemplate.worker_id == worker_id,
        )
    )
    shift_template = session.scalar(query)
    if shift_template is None:
        raise NotFoundError(
            f"Worker shift template {shift_template_id} was not found for worker {worker_id}."
        )
    return shift_template


def update_worker_shift_template(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    payload: WorkerShiftTemplateUpdate,
) -> WorkerShiftTemplate:
    shift_template = get_worker_shift_template(session, organization_id, worker_id, shift_template_id)
    updates = payload.model_dump(exclude_unset=True)

    next_name = updates.get("name", shift_template.name)
    next_day_of_week = updates.get("day_of_week", shift_template.day_of_week)
    if next_name != shift_template.name or next_day_of_week != shift_template.day_of_week:
        _ensure_unique_worker_shift_template(
            session,
            worker_id,
            str(next_name),
            int(next_day_of_week),
            exclude_id=shift_template_id,
        )

    next_start_minute = int(updates.get("start_minute_local", shift_template.start_minute_local))
    next_end_minute = int(updates.get("end_minute_local", shift_template.end_minute_local))
    _validate_shift_minutes(next_start_minute, next_end_minute)
    _validate_effective_range(
        updates.get("effective_from", shift_template.effective_from),
        updates.get("effective_to", shift_template.effective_to),
    )

    for break_rule in shift_template.break_rules:
        _validate_break_rule_fits_shift(
            break_rule.start_minute_local,
            break_rule.duration_minutes,
            next_start_minute,
            next_end_minute,
        )

    for field, value in updates.items():
        setattr(shift_template, field, value)
    session.commit()
    return get_worker_shift_template(session, organization_id, worker_id, shift_template_id)


def delete_worker_shift_template(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
) -> None:
    shift_template = get_worker_shift_template(session, organization_id, worker_id, shift_template_id)
    session.delete(shift_template)
    session.commit()


def list_worker_shift_break_rules(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
) -> list[WorkerShiftBreakRule]:
    get_worker_shift_template(session, organization_id, worker_id, shift_template_id)
    query = (
        select(WorkerShiftBreakRule)
        .where(WorkerShiftBreakRule.shift_template_id == shift_template_id)
        .order_by(WorkerShiftBreakRule.start_minute_local.asc(), WorkerShiftBreakRule.name.asc())
    )
    return list(session.scalars(query))


def create_worker_shift_break_rule(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    payload: WorkerShiftBreakRuleCreate,
) -> WorkerShiftBreakRule:
    shift_template = get_worker_shift_template(session, organization_id, worker_id, shift_template_id)
    _validate_break_rule_fits_shift(
        payload.start_minute_local,
        payload.duration_minutes,
        shift_template.start_minute_local,
        shift_template.end_minute_local,
    )
    _ensure_unique_shift_break_rule(
        session,
        shift_template_id,
        payload.name,
        payload.start_minute_local,
    )
    created_at = datetime.now(UTC)
    break_rule = WorkerShiftBreakRule(
        shift_template_id=shift_template_id,
        created_at=created_at,
        updated_at=created_at,
        **payload.model_dump(),
    )
    session.add(break_rule)
    session.commit()
    session.refresh(break_rule)
    return break_rule


def get_worker_shift_break_rule(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    break_rule_id: UUID,
) -> WorkerShiftBreakRule:
    get_worker_shift_template(session, organization_id, worker_id, shift_template_id)
    break_rule = session.get(WorkerShiftBreakRule, break_rule_id)
    if break_rule is None or break_rule.shift_template_id != shift_template_id:
        raise NotFoundError(
            f"Worker shift break rule {break_rule_id} was not found for shift template {shift_template_id}."
        )
    return break_rule


def update_worker_shift_break_rule(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    break_rule_id: UUID,
    payload: WorkerShiftBreakRuleUpdate,
) -> WorkerShiftBreakRule:
    break_rule = get_worker_shift_break_rule(
        session,
        organization_id,
        worker_id,
        shift_template_id,
        break_rule_id,
    )
    shift_template = get_worker_shift_template(session, organization_id, worker_id, shift_template_id)
    updates = payload.model_dump(exclude_unset=True)
    next_name = updates.get("name", break_rule.name)
    next_start_minute = int(updates.get("start_minute_local", break_rule.start_minute_local))
    next_duration = int(updates.get("duration_minutes", break_rule.duration_minutes))

    _validate_break_rule_fits_shift(
        next_start_minute,
        next_duration,
        shift_template.start_minute_local,
        shift_template.end_minute_local,
    )
    if next_name != break_rule.name or next_start_minute != break_rule.start_minute_local:
        _ensure_unique_shift_break_rule(
            session,
            shift_template_id,
            str(next_name),
            next_start_minute,
            exclude_id=break_rule_id,
        )

    for field, value in updates.items():
        setattr(break_rule, field, value)
    session.commit()
    session.refresh(break_rule)
    return break_rule


def delete_worker_shift_break_rule(
    session: Session,
    organization_id: UUID,
    worker_id: UUID,
    shift_template_id: UUID,
    break_rule_id: UUID,
) -> None:
    break_rule = get_worker_shift_break_rule(
        session,
        organization_id,
        worker_id,
        shift_template_id,
        break_rule_id,
    )
    session.delete(break_rule)
    session.commit()


def _count(session: Session, query: Select) -> int:
    return int(session.scalar(query) or 0)


def _require_organization(session: Session, organization_id: UUID) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise NotFoundError(f"Organization {organization_id} was not found.")
    return organization


def _ensure_unique_skill_code(
    session: Session, organization_id: UUID, code: str, exclude_id: UUID | None = None
) -> None:
    query = select(Skill).where(Skill.organization_id == organization_id, Skill.code == code)
    if exclude_id is not None:
        query = query.where(Skill.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Skill code '{code}' is already in use for this organization.")


def _ensure_unique_certification_code(
    session: Session,
    organization_id: UUID,
    code: str,
    exclude_id: UUID | None = None,
) -> None:
    query = select(Certification).where(
        Certification.organization_id == organization_id,
        Certification.code == code,
    )
    if exclude_id is not None:
        query = query.where(Certification.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Certification code '{code}' is already in use for this organization.")


def _ensure_unique_worker_code(
    session: Session,
    organization_id: UUID,
    worker_code: str,
    exclude_id: UUID | None = None,
) -> None:
    query = select(Worker).where(
        Worker.organization_id == organization_id,
        Worker.worker_code == worker_code,
    )
    if exclude_id is not None:
        query = query.where(Worker.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Worker code '{worker_code}' is already in use for this organization.")


def _validate_worker_home_refs(
    session: Session,
    organization_id: UUID,
    home_location_id: UUID | None,
    home_planning_unit_id: UUID | None,
) -> None:
    if home_location_id is not None:
        location = session.get(Location, home_location_id)
        if location is None or location.organization_id != organization_id:
            raise ValidationError(
                f"Home location {home_location_id} does not belong to organization {organization_id}."
            )
    if home_planning_unit_id is not None:
        planning_unit = session.get(PlanningUnit, home_planning_unit_id)
        if planning_unit is None or planning_unit.organization_id != organization_id:
            raise ValidationError(
                "Home planning unit "
                f"{home_planning_unit_id} does not belong to organization {organization_id}."
            )


def _ensure_skill_belongs_to_org(session: Session, organization_id: UUID, skill_id: UUID) -> Skill:
    skill = session.get(Skill, skill_id)
    if skill is None or skill.organization_id != organization_id:
        raise ValidationError(f"Skill {skill_id} does not belong to organization {organization_id}.")
    return skill


def _ensure_certification_belongs_to_org(
    session: Session,
    organization_id: UUID,
    certification_id: UUID,
) -> Certification:
    certification = session.get(Certification, certification_id)
    if certification is None or certification.organization_id != organization_id:
        raise ValidationError(
            f"Certification {certification_id} does not belong to organization {organization_id}."
        )
    return certification


def _ensure_unique_worker_skill(session: Session, worker_id: UUID, skill_id: UUID) -> None:
    query = select(WorkerSkill).where(WorkerSkill.worker_id == worker_id, WorkerSkill.skill_id == skill_id)
    if session.scalar(query) is not None:
        raise ConflictError("This worker already has that skill assignment.")


def _ensure_unique_worker_certification(
    session: Session, worker_id: UUID, certification_id: UUID
) -> None:
    query = select(WorkerCertification).where(
        WorkerCertification.worker_id == worker_id,
        WorkerCertification.certification_id == certification_id,
    )
    if session.scalar(query) is not None:
        raise ConflictError("This worker already has that certification assignment.")


def _ensure_unique_worker_shift_template(
    session: Session,
    worker_id: UUID,
    name: str,
    day_of_week: int,
    exclude_id: UUID | None = None,
) -> None:
    query = select(WorkerShiftTemplate).where(
        WorkerShiftTemplate.worker_id == worker_id,
        WorkerShiftTemplate.name == name,
        WorkerShiftTemplate.day_of_week == day_of_week,
    )
    if exclude_id is not None:
        query = query.where(WorkerShiftTemplate.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(
            f"Shift template '{name}' already exists for this worker on weekday {day_of_week}."
        )


def _ensure_unique_shift_break_rule(
    session: Session,
    shift_template_id: UUID,
    name: str,
    start_minute_local: int,
    exclude_id: UUID | None = None,
) -> None:
    query = select(WorkerShiftBreakRule).where(
        WorkerShiftBreakRule.shift_template_id == shift_template_id,
        WorkerShiftBreakRule.name == name,
        WorkerShiftBreakRule.start_minute_local == start_minute_local,
    )
    if exclude_id is not None:
        query = query.where(WorkerShiftBreakRule.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(
            f"Break rule '{name}' already exists at minute {start_minute_local} for this shift template."
        )


def _validate_certification_dates(
    issued_at,
    expires_at,
) -> None:
    if issued_at is not None and expires_at is not None and expires_at <= issued_at:
        raise ValidationError("Certification expiry must be later than the issued timestamp.")


def _validate_effective_range(effective_from, effective_to) -> None:
    if effective_from is not None and effective_to is not None and effective_to <= effective_from:
        raise ValidationError("Calendar effective_to must be later than effective_from.")


def _validate_shift_minutes(start_minute_local: int, end_minute_local: int) -> None:
    if start_minute_local == end_minute_local:
        raise ValidationError("Shift template end_minute_local must differ from start_minute_local.")


def _validate_break_rule_fits_shift(
    break_start_minute_local: int,
    break_duration_minutes: int,
    shift_start_minute_local: int,
    shift_end_minute_local: int,
) -> None:
    shift_start, shift_end = _shift_interval_bounds(shift_start_minute_local, shift_end_minute_local)
    normalized_break_start = break_start_minute_local
    if shift_end > 1440 and normalized_break_start < shift_start:
        normalized_break_start += 1440
    normalized_break_end = normalized_break_start + break_duration_minutes
    if normalized_break_start < shift_start or normalized_break_end > shift_end:
        raise ValidationError(
            "Break rule must fall fully within the shift template interval for its local day."
        )


def _shift_interval_bounds(start_minute_local: int, end_minute_local: int) -> tuple[int, int]:
    if end_minute_local > start_minute_local:
        return start_minute_local, end_minute_local
    return start_minute_local, end_minute_local + 1440


def _validate_window_range(start_at, end_at) -> None:
    if end_at <= start_at:
        raise ValidationError("Availability window end_at must be later than start_at.")
