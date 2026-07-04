from collections import deque
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session
from zenith_schemas.demand import (
    ServiceLevelPolicyCreate,
    ServiceLevelPolicyUpdate,
    WorkOrderCreate,
    WorkOrderDependencyCreate,
    WorkOrderDependencyUpdate,
    WorkOrderUpdate,
    WorkRequirementCreate,
    WorkRequirementUpdate,
)

from app.db.models.demand import ServiceLevelPolicy, WorkOrder, WorkOrderDependency, WorkRequirement
from app.db.models.organization import Location, Organization, PlanningUnit
from app.db.models.resources import EquipmentType, Material
from app.db.models.workforce import Certification, Skill
from app.services.errors import ConflictError, NotFoundError, ValidationError

REQUIREMENT_TYPES = {"skill", "certification", "headcount", "location_access", "material", "equipment_type"}
DEPENDENCY_TYPES = {"finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"}


def list_service_level_policies(session: Session, organization_id: UUID) -> list[ServiceLevelPolicy]:
    _require_organization(session, organization_id)
    query = (
        select(ServiceLevelPolicy)
        .where(ServiceLevelPolicy.organization_id == organization_id)
        .order_by(ServiceLevelPolicy.name.asc())
    )
    return list(session.scalars(query))


def create_service_level_policy(
    session: Session, organization_id: UUID, payload: ServiceLevelPolicyCreate
) -> ServiceLevelPolicy:
    _require_organization(session, organization_id)
    _ensure_unique_service_level_policy_name(session, organization_id, payload.name)
    policy = ServiceLevelPolicy(organization_id=organization_id, **payload.model_dump())
    session.add(policy)
    session.commit()
    session.refresh(policy)
    return policy


def get_service_level_policy(
    session: Session, organization_id: UUID, policy_id: UUID
) -> ServiceLevelPolicy:
    policy = session.get(ServiceLevelPolicy, policy_id)
    if policy is None or policy.organization_id != organization_id:
        raise NotFoundError(
            f"Service level policy {policy_id} was not found in organization {organization_id}."
        )
    return policy


def update_service_level_policy(
    session: Session,
    organization_id: UUID,
    policy_id: UUID,
    payload: ServiceLevelPolicyUpdate,
) -> ServiceLevelPolicy:
    policy = get_service_level_policy(session, organization_id, policy_id)
    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != policy.name:
        _ensure_unique_service_level_policy_name(
            session,
            organization_id,
            updates["name"],
            exclude_id=policy_id,
        )
    for field, value in updates.items():
        setattr(policy, field, value)
    session.commit()
    session.refresh(policy)
    return policy


def delete_service_level_policy(session: Session, organization_id: UUID, policy_id: UUID) -> None:
    policy = get_service_level_policy(session, organization_id, policy_id)
    if policy.work_orders:
        raise ConflictError("Cannot delete a service level policy that is still assigned to work orders.")
    session.delete(policy)
    session.commit()


def list_work_orders(session: Session, organization_id: UUID) -> list[WorkOrder]:
    _require_organization(session, organization_id)
    query = select(WorkOrder).where(WorkOrder.organization_id == organization_id).order_by(WorkOrder.created_at.asc())
    return list(session.scalars(query))


def create_work_order(session: Session, organization_id: UUID, payload: WorkOrderCreate) -> WorkOrder:
    _require_organization(session, organization_id)
    _validate_work_order_refs(
        session,
        organization_id,
        payload.location_id,
        payload.planning_unit_id,
        payload.service_level_policy_id,
    )
    _validate_schedule_range(payload.requested_start_at, payload.due_at)
    work_order = WorkOrder(organization_id=organization_id, **payload.model_dump())
    session.add(work_order)
    session.commit()
    session.refresh(work_order)
    return work_order


def get_work_order(session: Session, organization_id: UUID, work_order_id: UUID) -> WorkOrder:
    work_order = session.get(WorkOrder, work_order_id)
    if work_order is None or work_order.organization_id != organization_id:
        raise NotFoundError(f"Work order {work_order_id} was not found in organization {organization_id}.")
    return work_order


def update_work_order(
    session: Session,
    organization_id: UUID,
    work_order_id: UUID,
    payload: WorkOrderUpdate,
) -> WorkOrder:
    work_order = get_work_order(session, organization_id, work_order_id)
    updates = payload.model_dump(exclude_unset=True)
    location_id = updates.get("location_id", work_order.location_id)
    planning_unit_id = updates.get("planning_unit_id", work_order.planning_unit_id)
    policy_id = updates.get("service_level_policy_id", work_order.service_level_policy_id)
    requested_start_at = updates.get("requested_start_at", work_order.requested_start_at)
    due_at = updates.get("due_at", work_order.due_at)
    if {"location_id", "planning_unit_id", "service_level_policy_id"} & updates.keys():
        _validate_work_order_refs(session, organization_id, location_id, planning_unit_id, policy_id)
    if "requested_start_at" in updates or "due_at" in updates:
        _validate_schedule_range(requested_start_at, due_at)
    for field, value in updates.items():
        setattr(work_order, field, value)
    session.commit()
    session.refresh(work_order)
    return work_order


def delete_work_order(session: Session, organization_id: UUID, work_order_id: UUID) -> None:
    work_order = get_work_order(session, organization_id, work_order_id)
    if work_order.requirements:
        raise ConflictError("Cannot delete a work order that still has requirements.")
    if work_order.predecessor_dependencies or work_order.successor_dependencies:
        raise ConflictError("Cannot delete a work order that still participates in dependencies.")
    session.delete(work_order)
    session.commit()


def list_work_requirements(
    session: Session, organization_id: UUID, work_order_id: UUID
) -> list[WorkRequirement]:
    get_work_order(session, organization_id, work_order_id)
    query = (
        select(WorkRequirement)
        .where(WorkRequirement.work_order_id == work_order_id)
        .order_by(WorkRequirement.created_at.asc())
    )
    return list(session.scalars(query))


def create_work_requirement(
    session: Session,
    organization_id: UUID,
    work_order_id: UUID,
    payload: WorkRequirementCreate,
) -> WorkRequirement:
    get_work_order(session, organization_id, work_order_id)
    _validate_requirement(session, organization_id, payload.requirement_type, payload.reference_id, payload.min_level)
    requirement = WorkRequirement(work_order_id=work_order_id, **payload.model_dump())
    session.add(requirement)
    session.commit()
    session.refresh(requirement)
    return requirement


def get_work_requirement(
    session: Session,
    organization_id: UUID,
    work_order_id: UUID,
    requirement_id: UUID,
) -> WorkRequirement:
    get_work_order(session, organization_id, work_order_id)
    requirement = session.get(WorkRequirement, requirement_id)
    if requirement is None or requirement.work_order_id != work_order_id:
        raise NotFoundError(
            f"Work requirement {requirement_id} was not found for work order {work_order_id}."
        )
    return requirement


def update_work_requirement(
    session: Session,
    organization_id: UUID,
    work_order_id: UUID,
    requirement_id: UUID,
    payload: WorkRequirementUpdate,
) -> WorkRequirement:
    requirement = get_work_requirement(session, organization_id, work_order_id, requirement_id)
    updates = payload.model_dump(exclude_unset=True)
    requirement_type = updates.get("requirement_type", requirement.requirement_type)
    reference_id = updates.get("reference_id", requirement.reference_id)
    min_level = updates.get("min_level", requirement.min_level)
    _validate_requirement(session, organization_id, requirement_type, reference_id, min_level)
    for field, value in updates.items():
        setattr(requirement, field, value)
    session.commit()
    session.refresh(requirement)
    return requirement


def delete_work_requirement(
    session: Session,
    organization_id: UUID,
    work_order_id: UUID,
    requirement_id: UUID,
) -> None:
    requirement = get_work_requirement(session, organization_id, work_order_id, requirement_id)
    session.delete(requirement)
    session.commit()


def list_work_order_dependencies(
    session: Session, organization_id: UUID
) -> list[WorkOrderDependency]:
    _require_organization(session, organization_id)
    query = (
        select(WorkOrderDependency)
        .join(
            WorkOrder,
            WorkOrder.id == WorkOrderDependency.predecessor_work_order_id,
        )
        .where(WorkOrder.organization_id == organization_id)
        .order_by(WorkOrderDependency.created_at.asc())
    )
    return list(session.scalars(query))


def create_work_order_dependency(
    session: Session,
    organization_id: UUID,
    payload: WorkOrderDependencyCreate,
) -> WorkOrderDependency:
    _validate_dependency(
        session,
        organization_id,
        payload.predecessor_work_order_id,
        payload.successor_work_order_id,
        payload.dependency_type,
    )
    _ensure_unique_dependency(
        session,
        payload.predecessor_work_order_id,
        payload.successor_work_order_id,
    )
    dependency = WorkOrderDependency(**payload.model_dump())
    session.add(dependency)
    session.commit()
    session.refresh(dependency)
    return dependency


def get_work_order_dependency(
    session: Session, organization_id: UUID, dependency_id: UUID
) -> WorkOrderDependency:
    dependency = session.get(WorkOrderDependency, dependency_id)
    if dependency is None:
        raise NotFoundError(f"Work order dependency {dependency_id} was not found.")
    predecessor = get_work_order(session, organization_id, dependency.predecessor_work_order_id)
    successor = get_work_order(session, organization_id, dependency.successor_work_order_id)
    if predecessor.organization_id != organization_id or successor.organization_id != organization_id:
        raise NotFoundError(f"Work order dependency {dependency_id} was not found in organization {organization_id}.")
    return dependency


def update_work_order_dependency(
    session: Session,
    organization_id: UUID,
    dependency_id: UUID,
    payload: WorkOrderDependencyUpdate,
) -> WorkOrderDependency:
    dependency = get_work_order_dependency(session, organization_id, dependency_id)
    updates = payload.model_dump(exclude_unset=True)
    predecessor_id = updates.get("predecessor_work_order_id", dependency.predecessor_work_order_id)
    successor_id = updates.get("successor_work_order_id", dependency.successor_work_order_id)
    dependency_type = updates.get("dependency_type", dependency.dependency_type)
    _validate_dependency(session, organization_id, predecessor_id, successor_id, dependency_type)
    if (
        predecessor_id != dependency.predecessor_work_order_id
        or successor_id != dependency.successor_work_order_id
    ):
        _ensure_unique_dependency(
            session,
            predecessor_id,
            successor_id,
            exclude_id=dependency_id,
        )
    for field, value in updates.items():
        setattr(dependency, field, value)
    session.commit()
    session.refresh(dependency)
    return dependency


def delete_work_order_dependency(
    session: Session, organization_id: UUID, dependency_id: UUID
) -> None:
    dependency = get_work_order_dependency(session, organization_id, dependency_id)
    session.delete(dependency)
    session.commit()


def _require_organization(session: Session, organization_id: UUID) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise NotFoundError(f"Organization {organization_id} was not found.")
    return organization


def _ensure_unique_service_level_policy_name(
    session: Session, organization_id: UUID, name: str, exclude_id: UUID | None = None
) -> None:
    query = select(ServiceLevelPolicy).where(
        ServiceLevelPolicy.organization_id == organization_id,
        ServiceLevelPolicy.name == name,
    )
    if exclude_id is not None:
        query = query.where(ServiceLevelPolicy.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Service level policy '{name}' already exists in this organization.")


def _validate_work_order_refs(
    session: Session,
    organization_id: UUID,
    location_id: UUID,
    planning_unit_id: UUID | None,
    service_level_policy_id: UUID | None,
) -> None:
    location = session.get(Location, location_id)
    if location is None or location.organization_id != organization_id:
        raise ValidationError(f"Location {location_id} does not belong to organization {organization_id}.")
    if planning_unit_id is not None:
        planning_unit = session.get(PlanningUnit, planning_unit_id)
        if planning_unit is None or planning_unit.organization_id != organization_id:
            raise ValidationError(
                f"Planning unit {planning_unit_id} does not belong to organization {organization_id}."
            )
    if service_level_policy_id is not None:
        policy = session.get(ServiceLevelPolicy, service_level_policy_id)
        if policy is None or policy.organization_id != organization_id:
            raise ValidationError(
                "Service level policy "
                f"{service_level_policy_id} does not belong to organization {organization_id}."
            )


def _validate_schedule_range(requested_start_at, due_at) -> None:
    if requested_start_at is not None and due_at is not None and due_at <= requested_start_at:
        raise ValidationError("Work order due_at must be later than requested_start_at.")


def _validate_requirement(
    session: Session,
    organization_id: UUID,
    requirement_type: str,
    reference_id: UUID | None,
    min_level: int | None,
) -> None:
    if requirement_type not in REQUIREMENT_TYPES:
        raise ValidationError(
            "Requirement type must be one of: "
            + ", ".join(sorted(REQUIREMENT_TYPES))
            + "."
        )
    if requirement_type == "skill":
        if reference_id is None:
            raise ValidationError("Skill requirements must include a reference_id.")
        skill = session.get(Skill, reference_id)
        if skill is None or skill.organization_id != organization_id:
            raise ValidationError(f"Skill {reference_id} does not belong to organization {organization_id}.")
    elif requirement_type == "certification":
        if reference_id is None:
            raise ValidationError("Certification requirements must include a reference_id.")
        certification = session.get(Certification, reference_id)
        if certification is None or certification.organization_id != organization_id:
            raise ValidationError(
                f"Certification {reference_id} does not belong to organization {organization_id}."
            )
        if min_level is not None:
            raise ValidationError("Certification requirements must not include min_level.")
    elif requirement_type == "material":
        if reference_id is None:
            raise ValidationError("Material requirements must include a reference_id.")
        material = session.get(Material, reference_id)
        if material is None or material.organization_id != organization_id:
            raise ValidationError(f"Material {reference_id} does not belong to organization {organization_id}.")
        if min_level is not None:
            raise ValidationError("Material requirements must not include min_level.")
    elif requirement_type == "equipment_type":
        if reference_id is None:
            raise ValidationError("Equipment type requirements must include a reference_id.")
        equipment_type = session.get(EquipmentType, reference_id)
        if equipment_type is None or equipment_type.organization_id != organization_id:
            raise ValidationError(
                f"Equipment type {reference_id} does not belong to organization {organization_id}."
            )
        if min_level is not None:
            raise ValidationError("Equipment type requirements must not include min_level.")
    elif requirement_type == "headcount":
        if reference_id is not None:
            raise ValidationError("Headcount requirements must not include a reference_id.")
        if min_level is not None:
            raise ValidationError("Headcount requirements must not include min_level.")
    elif min_level is not None:
        raise ValidationError(f"{requirement_type} requirements must not include min_level.")


def _validate_dependency(
    session: Session,
    organization_id: UUID,
    predecessor_work_order_id: UUID,
    successor_work_order_id: UUID,
    dependency_type: str,
) -> None:
    if dependency_type not in DEPENDENCY_TYPES:
        raise ValidationError(
            "Dependency type must be one of: " + ", ".join(sorted(DEPENDENCY_TYPES)) + "."
        )
    if predecessor_work_order_id == successor_work_order_id:
        raise ValidationError("A work order cannot depend on itself.")
    get_work_order(session, organization_id, predecessor_work_order_id)
    get_work_order(session, organization_id, successor_work_order_id)
    _ensure_no_dependency_cycle(session, predecessor_work_order_id, successor_work_order_id)


def _ensure_unique_dependency(
    session: Session,
    predecessor_work_order_id: UUID,
    successor_work_order_id: UUID,
    exclude_id: UUID | None = None,
) -> None:
    query = select(WorkOrderDependency).where(
        WorkOrderDependency.predecessor_work_order_id == predecessor_work_order_id,
        WorkOrderDependency.successor_work_order_id == successor_work_order_id,
    )
    if exclude_id is not None:
        query = query.where(WorkOrderDependency.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError("That work order dependency already exists.")


def _ensure_no_dependency_cycle(
    session: Session,
    predecessor_work_order_id: UUID,
    successor_work_order_id: UUID,
) -> None:
    queue = deque([successor_work_order_id])
    visited: set[UUID] = set()

    while queue:
        current = queue.popleft()
        if current in visited:
            continue
        visited.add(current)
        if current == predecessor_work_order_id:
            raise ValidationError("This dependency would create a cycle in the work-order graph.")
        query = select(WorkOrderDependency.successor_work_order_id).where(
            WorkOrderDependency.predecessor_work_order_id == current
        )
        queue.extend(session.scalars(query))
