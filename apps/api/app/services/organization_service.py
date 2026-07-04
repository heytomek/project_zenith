from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session
from zenith_schemas.org_identity import (
    LocationCreate,
    LocationUpdate,
    OrganizationCreate,
    OrganizationUpdate,
    PlanningUnitCreate,
    PlanningUnitUpdate,
)

from app.db.models.demand import ServiceLevelPolicy, WorkOrder
from app.db.models.organization import Location, Organization, PlanningUnit
from app.db.models.resources import Equipment, EquipmentType, InventoryPosition, Material
from app.db.models.workforce import Certification, Skill, Worker
from app.services.errors import ConflictError, NotFoundError, ValidationError


def list_organizations(session: Session) -> list[Organization]:
    return list(session.scalars(select(Organization).order_by(Organization.name.asc())))


def create_organization(session: Session, payload: OrganizationCreate) -> Organization:
    _ensure_unique_organization_slug(session, payload.slug)
    organization = Organization(**payload.model_dump())
    session.add(organization)
    session.commit()
    session.refresh(organization)
    return organization


def get_organization(session: Session, organization_id: UUID) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise NotFoundError(f"Organization {organization_id} was not found.")
    return organization


def update_organization(
    session: Session, organization_id: UUID, payload: OrganizationUpdate
) -> Organization:
    organization = get_organization(session, organization_id)
    updates = payload.model_dump(exclude_unset=True)
    if "slug" in updates and updates["slug"] != organization.slug:
        _ensure_unique_organization_slug(session, updates["slug"], exclude_id=organization_id)

    for field, value in updates.items():
        setattr(organization, field, value)

    session.commit()
    session.refresh(organization)
    return organization


def delete_organization(session: Session, organization_id: UUID) -> None:
    organization = get_organization(session, organization_id)

    if _count(session, select(func.count()).select_from(PlanningUnit).where(
        PlanningUnit.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has planning units.")
    if _count(session, select(func.count()).select_from(Location).where(
        Location.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has locations.")
    if _count(session, select(func.count()).select_from(Skill).where(
        Skill.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has skills.")
    if _count(session, select(func.count()).select_from(Certification).where(
        Certification.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has certifications.")
    if _count(session, select(func.count()).select_from(Material).where(
        Material.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has materials.")
    if _count(session, select(func.count()).select_from(EquipmentType).where(
        EquipmentType.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has equipment types.")
    if _count(session, select(func.count()).select_from(Equipment).where(
        Equipment.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has equipment units.")
    if _count(session, select(func.count()).select_from(InventoryPosition).join(Material).where(
        Material.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has inventory positions.")
    if _count(session, select(func.count()).select_from(Worker).where(
        Worker.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has workers.")
    if _count(session, select(func.count()).select_from(ServiceLevelPolicy).where(
        ServiceLevelPolicy.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has service level policies.")
    if _count(session, select(func.count()).select_from(WorkOrder).where(
        WorkOrder.organization_id == organization_id
    )):
        raise ConflictError("Cannot delete an organization that still has work orders.")
    if organization.users:
        raise ConflictError("Cannot delete an organization that still has users.")

    session.delete(organization)
    session.commit()


def list_planning_units(session: Session, organization_id: UUID) -> list[PlanningUnit]:
    get_organization(session, organization_id)
    query = (
        select(PlanningUnit)
        .where(PlanningUnit.organization_id == organization_id)
        .order_by(PlanningUnit.name.asc())
    )
    return list(session.scalars(query))


def create_planning_unit(
    session: Session, organization_id: UUID, payload: PlanningUnitCreate
) -> PlanningUnit:
    get_organization(session, organization_id)
    _ensure_unique_planning_unit_name(session, organization_id, payload.name)
    if payload.parent_unit_id is not None:
        _require_planning_unit(session, organization_id, payload.parent_unit_id)

    planning_unit = PlanningUnit(organization_id=organization_id, **payload.model_dump())
    session.add(planning_unit)
    session.commit()
    session.refresh(planning_unit)
    return planning_unit


def get_planning_unit(
    session: Session, organization_id: UUID, planning_unit_id: UUID
) -> PlanningUnit:
    planning_unit = _require_planning_unit(session, organization_id, planning_unit_id)
    return planning_unit


def update_planning_unit(
    session: Session,
    organization_id: UUID,
    planning_unit_id: UUID,
    payload: PlanningUnitUpdate,
) -> PlanningUnit:
    planning_unit = get_planning_unit(session, organization_id, planning_unit_id)
    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates and updates["name"] != planning_unit.name:
        _ensure_unique_planning_unit_name(
            session,
            organization_id,
            updates["name"],
            exclude_id=planning_unit_id,
        )

    if "parent_unit_id" in updates:
        parent_unit_id = updates["parent_unit_id"]
        if parent_unit_id == planning_unit_id:
            raise ValidationError("A planning unit cannot be its own parent.")
        if parent_unit_id is not None:
            _require_planning_unit(session, organization_id, parent_unit_id)
            _ensure_no_planning_unit_cycle(session, planning_unit_id, parent_unit_id)

    for field, value in updates.items():
        setattr(planning_unit, field, value)

    session.commit()
    session.refresh(planning_unit)
    return planning_unit


def delete_planning_unit(session: Session, organization_id: UUID, planning_unit_id: UUID) -> None:
    planning_unit = get_planning_unit(session, organization_id, planning_unit_id)

    if planning_unit.child_units:
        raise ConflictError("Cannot delete a planning unit that still has child units.")
    if planning_unit.work_orders:
        raise ConflictError("Cannot delete a planning unit that is still assigned to work orders.")
    if planning_unit.workers:
        raise ConflictError("Cannot delete a planning unit that is still assigned as a worker home unit.")

    session.delete(planning_unit)
    session.commit()


def list_locations(session: Session, organization_id: UUID) -> list[Location]:
    get_organization(session, organization_id)
    query = select(Location).where(Location.organization_id == organization_id).order_by(Location.name.asc())
    return list(session.scalars(query))


def create_location(session: Session, organization_id: UUID, payload: LocationCreate) -> Location:
    get_organization(session, organization_id)
    _ensure_unique_location_code(session, organization_id, payload.code)
    location = Location(organization_id=organization_id, **payload.model_dump())
    session.add(location)
    session.commit()
    session.refresh(location)
    return location


def get_location(session: Session, organization_id: UUID, location_id: UUID) -> Location:
    location = session.get(Location, location_id)
    if location is None or location.organization_id != organization_id:
        raise NotFoundError(f"Location {location_id} was not found in organization {organization_id}.")
    return location


def update_location(
    session: Session,
    organization_id: UUID,
    location_id: UUID,
    payload: LocationUpdate,
) -> Location:
    location = get_location(session, organization_id, location_id)
    updates = payload.model_dump(exclude_unset=True)

    if "code" in updates and updates["code"] != location.code:
        _ensure_unique_location_code(
            session,
            organization_id,
            updates["code"],
            exclude_id=location_id,
        )

    for field, value in updates.items():
        setattr(location, field, value)

    session.commit()
    session.refresh(location)
    return location


def delete_location(session: Session, organization_id: UUID, location_id: UUID) -> None:
    location = get_location(session, organization_id, location_id)
    if location.work_orders:
        raise ConflictError("Cannot delete a location that is still assigned to work orders.")
    if location.workers:
        raise ConflictError("Cannot delete a location that is still assigned as a worker home location.")
    if location.inventory_positions:
        raise ConflictError("Cannot delete a location that still has inventory positions.")
    if location.equipment:
        raise ConflictError("Cannot delete a location that still has equipment assigned to it.")
    session.delete(location)
    session.commit()


def _count(session: Session, query: Select) -> int:
    return int(session.scalar(query) or 0)


def _ensure_unique_organization_slug(
    session: Session, slug: str, exclude_id: UUID | None = None
) -> None:
    query = select(Organization).where(Organization.slug == slug)
    if exclude_id is not None:
        query = query.where(Organization.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Organization slug '{slug}' is already in use.")


def _ensure_unique_planning_unit_name(
    session: Session, organization_id: UUID, name: str, exclude_id: UUID | None = None
) -> None:
    query = select(PlanningUnit).where(
        PlanningUnit.organization_id == organization_id,
        PlanningUnit.name == name,
    )
    if exclude_id is not None:
        query = query.where(PlanningUnit.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Planning unit name '{name}' is already in use for this organization.")


def _ensure_unique_location_code(
    session: Session, organization_id: UUID, code: str, exclude_id: UUID | None = None
) -> None:
    query = select(Location).where(
        Location.organization_id == organization_id,
        Location.code == code,
    )
    if exclude_id is not None:
        query = query.where(Location.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Location code '{code}' is already in use for this organization.")


def _require_planning_unit(
    session: Session, organization_id: UUID, planning_unit_id: UUID
) -> PlanningUnit:
    planning_unit = session.get(PlanningUnit, planning_unit_id)
    if planning_unit is None or planning_unit.organization_id != organization_id:
        raise ValidationError(
            f"Planning unit {planning_unit_id} does not belong to organization {organization_id}."
        )
    return planning_unit


def _ensure_no_planning_unit_cycle(
    session: Session, planning_unit_id: UUID, proposed_parent_id: UUID
) -> None:
    current_id: UUID | None = proposed_parent_id
    while current_id is not None:
        if current_id == planning_unit_id:
            raise ValidationError("Updating the parent unit would create a cycle.")
        current = session.get(PlanningUnit, current_id)
        current_id = current.parent_unit_id if current is not None else None
