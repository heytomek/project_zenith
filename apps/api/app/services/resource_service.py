from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from zenith_schemas.resources import (
    EquipmentAvailabilityCalendarCreate,
    EquipmentAvailabilityCalendarUpdate,
    EquipmentAvailabilityWindowCreate,
    EquipmentAvailabilityWindowUpdate,
    EquipmentCreate,
    EquipmentTypeCreate,
    EquipmentTypeUpdate,
    EquipmentUpdate,
    InventoryPositionCreate,
    InventoryPositionUpdate,
    MaterialCreate,
    MaterialUpdate,
)

from app.db.models.demand import WorkRequirement
from app.db.models.organization import Location, Organization
from app.db.models.resources import (
    Equipment,
    EquipmentAvailabilityCalendar,
    EquipmentAvailabilityWindow,
    EquipmentType,
    InventoryPosition,
    Material,
)
from app.services.errors import ConflictError, NotFoundError, ValidationError


def list_materials(session: Session, organization_id: UUID) -> list[Material]:
    _require_organization(session, organization_id)
    query = select(Material).where(Material.organization_id == organization_id).order_by(Material.name.asc())
    return list(session.scalars(query))


def create_material(session: Session, organization_id: UUID, payload: MaterialCreate) -> Material:
    _require_organization(session, organization_id)
    _ensure_unique_material_sku(session, organization_id, payload.sku)
    material = Material(organization_id=organization_id, **payload.model_dump())
    session.add(material)
    session.commit()
    session.refresh(material)
    return material


def get_material(session: Session, organization_id: UUID, material_id: UUID) -> Material:
    material = session.get(Material, material_id)
    if material is None or material.organization_id != organization_id:
        raise NotFoundError(f"Material {material_id} was not found in organization {organization_id}.")
    return material


def update_material(
    session: Session,
    organization_id: UUID,
    material_id: UUID,
    payload: MaterialUpdate,
) -> Material:
    material = get_material(session, organization_id, material_id)
    updates = payload.model_dump(exclude_unset=True)
    if "sku" in updates and updates["sku"] != material.sku:
        _ensure_unique_material_sku(session, organization_id, updates["sku"], exclude_id=material_id)
    for field, value in updates.items():
        setattr(material, field, value)
    session.commit()
    session.refresh(material)
    return material


def delete_material(session: Session, organization_id: UUID, material_id: UUID) -> None:
    material = get_material(session, organization_id, material_id)
    if material.inventory_positions:
        raise ConflictError("Cannot delete a material that still has inventory positions.")
    requirement_query = select(WorkRequirement).where(
        WorkRequirement.requirement_type == "material",
        WorkRequirement.reference_id == material_id,
    )
    if session.scalar(requirement_query) is not None:
        raise ConflictError("Cannot delete a material that is still referenced by work requirements.")
    session.delete(material)
    session.commit()


def list_inventory_positions(session: Session, organization_id: UUID) -> list[InventoryPosition]:
    _require_organization(session, organization_id)
    query = (
        select(InventoryPosition)
        .options(selectinload(InventoryPosition.material))
        .join(Material)
        .where(Material.organization_id == organization_id)
        .order_by(InventoryPosition.created_at.asc())
    )
    return list(session.scalars(query))


def create_inventory_position(
    session: Session,
    organization_id: UUID,
    payload: InventoryPositionCreate,
) -> InventoryPosition:
    _require_organization(session, organization_id)
    _ensure_material_belongs_to_org(session, organization_id, payload.material_id)
    _ensure_location_belongs_to_org(session, organization_id, payload.location_id)
    _validate_inventory_quantities(payload.on_hand_quantity, payload.reserved_quantity)
    _ensure_unique_inventory_position(session, payload.material_id, payload.location_id)
    inventory_position = InventoryPosition(**payload.model_dump())
    session.add(inventory_position)
    session.commit()
    return get_inventory_position(session, organization_id, inventory_position.id)


def get_inventory_position(
    session: Session,
    organization_id: UUID,
    inventory_position_id: UUID,
) -> InventoryPosition:
    query = (
        select(InventoryPosition)
        .options(selectinload(InventoryPosition.material))
        .where(InventoryPosition.id == inventory_position_id)
    )
    inventory_position = session.scalar(query)
    if inventory_position is None or inventory_position.material.organization_id != organization_id:
        raise NotFoundError(
            f"Inventory position {inventory_position_id} was not found in organization {organization_id}."
        )
    return inventory_position


def update_inventory_position(
    session: Session,
    organization_id: UUID,
    inventory_position_id: UUID,
    payload: InventoryPositionUpdate,
) -> InventoryPosition:
    inventory_position = get_inventory_position(session, organization_id, inventory_position_id)
    updates = payload.model_dump(exclude_unset=True)
    on_hand_quantity = updates.get("on_hand_quantity", inventory_position.on_hand_quantity)
    reserved_quantity = updates.get("reserved_quantity", inventory_position.reserved_quantity)
    _validate_inventory_quantities(on_hand_quantity, reserved_quantity)
    for field, value in updates.items():
        setattr(inventory_position, field, value)
    session.commit()
    return get_inventory_position(session, organization_id, inventory_position_id)


def delete_inventory_position(
    session: Session,
    organization_id: UUID,
    inventory_position_id: UUID,
) -> None:
    inventory_position = get_inventory_position(session, organization_id, inventory_position_id)
    session.delete(inventory_position)
    session.commit()


def list_equipment_types(session: Session, organization_id: UUID) -> list[EquipmentType]:
    _require_organization(session, organization_id)
    query = (
        select(EquipmentType)
        .where(EquipmentType.organization_id == organization_id)
        .order_by(EquipmentType.name.asc())
    )
    return list(session.scalars(query))


def create_equipment_type(
    session: Session,
    organization_id: UUID,
    payload: EquipmentTypeCreate,
) -> EquipmentType:
    _require_organization(session, organization_id)
    _ensure_unique_equipment_type_code(session, organization_id, payload.code)
    equipment_type = EquipmentType(organization_id=organization_id, **payload.model_dump())
    session.add(equipment_type)
    session.commit()
    session.refresh(equipment_type)
    return equipment_type


def get_equipment_type(
    session: Session,
    organization_id: UUID,
    equipment_type_id: UUID,
) -> EquipmentType:
    equipment_type = session.get(EquipmentType, equipment_type_id)
    if equipment_type is None or equipment_type.organization_id != organization_id:
        raise NotFoundError(
            f"Equipment type {equipment_type_id} was not found in organization {organization_id}."
        )
    return equipment_type


def update_equipment_type(
    session: Session,
    organization_id: UUID,
    equipment_type_id: UUID,
    payload: EquipmentTypeUpdate,
) -> EquipmentType:
    equipment_type = get_equipment_type(session, organization_id, equipment_type_id)
    updates = payload.model_dump(exclude_unset=True)
    if "code" in updates and updates["code"] != equipment_type.code:
        _ensure_unique_equipment_type_code(
            session,
            organization_id,
            updates["code"],
            exclude_id=equipment_type_id,
        )
    for field, value in updates.items():
        setattr(equipment_type, field, value)
    session.commit()
    session.refresh(equipment_type)
    return equipment_type


def delete_equipment_type(session: Session, organization_id: UUID, equipment_type_id: UUID) -> None:
    equipment_type = get_equipment_type(session, organization_id, equipment_type_id)
    if equipment_type.equipment:
        raise ConflictError("Cannot delete an equipment type that still has equipment units.")
    requirement_query = select(WorkRequirement).where(
        WorkRequirement.requirement_type == "equipment_type",
        WorkRequirement.reference_id == equipment_type_id,
    )
    if session.scalar(requirement_query) is not None:
        raise ConflictError("Cannot delete an equipment type that is still referenced by work requirements.")
    session.delete(equipment_type)
    session.commit()


def list_equipment(session: Session, organization_id: UUID) -> list[Equipment]:
    _require_organization(session, organization_id)
    query = (
        select(Equipment)
        .options(selectinload(Equipment.equipment_type))
        .where(Equipment.organization_id == organization_id)
        .order_by(Equipment.equipment_code.asc())
    )
    return list(session.scalars(query))


def create_equipment(session: Session, organization_id: UUID, payload: EquipmentCreate) -> Equipment:
    _require_organization(session, organization_id)
    _ensure_unique_equipment_code(session, organization_id, payload.equipment_code)
    _ensure_equipment_type_belongs_to_org(session, organization_id, payload.equipment_type_id)
    _ensure_location_belongs_to_org(session, organization_id, payload.location_id)
    equipment = Equipment(organization_id=organization_id, **payload.model_dump())
    session.add(equipment)
    session.commit()
    return get_equipment(session, organization_id, equipment.id)


def get_equipment(session: Session, organization_id: UUID, equipment_id: UUID) -> Equipment:
    query = (
        select(Equipment)
        .options(selectinload(Equipment.equipment_type))
        .where(Equipment.id == equipment_id)
    )
    equipment = session.scalar(query)
    if equipment is None or equipment.organization_id != organization_id:
        raise NotFoundError(f"Equipment {equipment_id} was not found in organization {organization_id}.")
    return equipment


def update_equipment(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    payload: EquipmentUpdate,
) -> Equipment:
    equipment = get_equipment(session, organization_id, equipment_id)
    updates = payload.model_dump(exclude_unset=True)
    if "equipment_code" in updates and updates["equipment_code"] != equipment.equipment_code:
        _ensure_unique_equipment_code(
            session,
            organization_id,
            updates["equipment_code"],
            exclude_id=equipment_id,
        )
    equipment_type_id = updates.get("equipment_type_id", equipment.equipment_type_id)
    location_id = updates.get("location_id", equipment.location_id)
    if "equipment_type_id" in updates:
        _ensure_equipment_type_belongs_to_org(session, organization_id, equipment_type_id)
    if "location_id" in updates:
        _ensure_location_belongs_to_org(session, organization_id, location_id)
    for field, value in updates.items():
        setattr(equipment, field, value)
    session.commit()
    return get_equipment(session, organization_id, equipment_id)


def delete_equipment(session: Session, organization_id: UUID, equipment_id: UUID) -> None:
    equipment = get_equipment(session, organization_id, equipment_id)
    session.delete(equipment)
    session.commit()


def list_equipment_availability_calendars(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
) -> list[EquipmentAvailabilityCalendar]:
    get_equipment(session, organization_id, equipment_id)
    query = (
        select(EquipmentAvailabilityCalendar)
        .where(EquipmentAvailabilityCalendar.equipment_id == equipment_id)
        .order_by(EquipmentAvailabilityCalendar.created_at.asc())
    )
    return list(session.scalars(query))


def create_equipment_availability_calendar(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    payload: EquipmentAvailabilityCalendarCreate,
) -> EquipmentAvailabilityCalendar:
    get_equipment(session, organization_id, equipment_id)
    _validate_effective_range(payload.effective_from, payload.effective_to, "effective_to")
    calendar = EquipmentAvailabilityCalendar(equipment_id=equipment_id, **payload.model_dump())
    session.add(calendar)
    session.commit()
    session.refresh(calendar)
    return calendar


def get_equipment_availability_calendar(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
) -> EquipmentAvailabilityCalendar:
    get_equipment(session, organization_id, equipment_id)
    calendar = session.get(EquipmentAvailabilityCalendar, calendar_id)
    if calendar is None or calendar.equipment_id != equipment_id:
        raise NotFoundError(
            f"Equipment availability calendar {calendar_id} was not found for equipment {equipment_id}."
        )
    return calendar


def update_equipment_availability_calendar(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    payload: EquipmentAvailabilityCalendarUpdate,
) -> EquipmentAvailabilityCalendar:
    calendar = get_equipment_availability_calendar(session, organization_id, equipment_id, calendar_id)
    updates = payload.model_dump(exclude_unset=True)
    effective_from = updates.get("effective_from", calendar.effective_from)
    effective_to = updates.get("effective_to", calendar.effective_to)
    _validate_effective_range(effective_from, effective_to, "effective_to")
    for field, value in updates.items():
        setattr(calendar, field, value)
    session.commit()
    session.refresh(calendar)
    return calendar


def delete_equipment_availability_calendar(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
) -> None:
    calendar = get_equipment_availability_calendar(session, organization_id, equipment_id, calendar_id)
    session.delete(calendar)
    session.commit()


def list_equipment_availability_windows(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
) -> list[EquipmentAvailabilityWindow]:
    get_equipment_availability_calendar(session, organization_id, equipment_id, calendar_id)
    query = (
        select(EquipmentAvailabilityWindow)
        .where(EquipmentAvailabilityWindow.calendar_id == calendar_id)
        .order_by(EquipmentAvailabilityWindow.created_at.asc())
    )
    return list(session.scalars(query))


def create_equipment_availability_window(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    payload: EquipmentAvailabilityWindowCreate,
) -> EquipmentAvailabilityWindow:
    get_equipment_availability_calendar(session, organization_id, equipment_id, calendar_id)
    _validate_time_range(payload.start_at, payload.end_at, "Equipment availability end_at")
    window = EquipmentAvailabilityWindow(calendar_id=calendar_id, **payload.model_dump())
    session.add(window)
    session.commit()
    session.refresh(window)
    return window


def get_equipment_availability_window(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
) -> EquipmentAvailabilityWindow:
    get_equipment_availability_calendar(session, organization_id, equipment_id, calendar_id)
    window = session.get(EquipmentAvailabilityWindow, window_id)
    if window is None or window.calendar_id != calendar_id:
        raise NotFoundError(
            f"Equipment availability window {window_id} was not found for calendar {calendar_id}."
        )
    return window


def update_equipment_availability_window(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
    payload: EquipmentAvailabilityWindowUpdate,
) -> EquipmentAvailabilityWindow:
    window = get_equipment_availability_window(
        session,
        organization_id,
        equipment_id,
        calendar_id,
        window_id,
    )
    updates = payload.model_dump(exclude_unset=True)
    start_at = updates.get("start_at", window.start_at)
    end_at = updates.get("end_at", window.end_at)
    _validate_time_range(start_at, end_at, "Equipment availability end_at")
    for field, value in updates.items():
        setattr(window, field, value)
    session.commit()
    session.refresh(window)
    return window


def delete_equipment_availability_window(
    session: Session,
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
) -> None:
    window = get_equipment_availability_window(
        session,
        organization_id,
        equipment_id,
        calendar_id,
        window_id,
    )
    session.delete(window)
    session.commit()


def _require_organization(session: Session, organization_id: UUID) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise NotFoundError(f"Organization {organization_id} was not found.")
    return organization


def _ensure_unique_material_sku(
    session: Session,
    organization_id: UUID,
    sku: str,
    exclude_id: UUID | None = None,
) -> None:
    query = select(Material).where(Material.organization_id == organization_id, Material.sku == sku)
    if exclude_id is not None:
        query = query.where(Material.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Material sku '{sku}' is already in use for this organization.")


def _ensure_unique_inventory_position(
    session: Session,
    material_id: UUID,
    location_id: UUID,
) -> None:
    query = select(InventoryPosition).where(
        InventoryPosition.material_id == material_id,
        InventoryPosition.location_id == location_id,
    )
    if session.scalar(query) is not None:
        raise ConflictError("An inventory position already exists for that material and location.")


def _ensure_unique_equipment_type_code(
    session: Session,
    organization_id: UUID,
    code: str,
    exclude_id: UUID | None = None,
) -> None:
    query = select(EquipmentType).where(
        EquipmentType.organization_id == organization_id,
        EquipmentType.code == code,
    )
    if exclude_id is not None:
        query = query.where(EquipmentType.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Equipment type code '{code}' is already in use for this organization.")


def _ensure_unique_equipment_code(
    session: Session,
    organization_id: UUID,
    equipment_code: str,
    exclude_id: UUID | None = None,
) -> None:
    query = select(Equipment).where(
        Equipment.organization_id == organization_id,
        Equipment.equipment_code == equipment_code,
    )
    if exclude_id is not None:
        query = query.where(Equipment.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Equipment code '{equipment_code}' is already in use for this organization.")


def _ensure_material_belongs_to_org(session: Session, organization_id: UUID, material_id: UUID) -> Material:
    material = session.get(Material, material_id)
    if material is None or material.organization_id != organization_id:
        raise ValidationError(f"Material {material_id} does not belong to organization {organization_id}.")
    return material


def _ensure_equipment_type_belongs_to_org(
    session: Session,
    organization_id: UUID,
    equipment_type_id: UUID,
) -> EquipmentType:
    equipment_type = session.get(EquipmentType, equipment_type_id)
    if equipment_type is None or equipment_type.organization_id != organization_id:
        raise ValidationError(
            f"Equipment type {equipment_type_id} does not belong to organization {organization_id}."
        )
    return equipment_type


def _ensure_location_belongs_to_org(session: Session, organization_id: UUID, location_id: UUID) -> Location:
    location = session.get(Location, location_id)
    if location is None or location.organization_id != organization_id:
        raise ValidationError(f"Location {location_id} does not belong to organization {organization_id}.")
    return location


def _validate_inventory_quantities(on_hand_quantity: int, reserved_quantity: int) -> None:
    if reserved_quantity > on_hand_quantity:
        raise ValidationError("Inventory reserved_quantity cannot exceed on_hand_quantity.")


def _validate_time_range(start_at, end_at, label: str) -> None:
    if end_at <= start_at:
        raise ValidationError(f"{label} must be later than start_at.")


def _validate_effective_range(effective_from, effective_to, label: str) -> None:
    if effective_from is not None and effective_to is not None and effective_to <= effective_from:
        raise ValidationError(f"{label} must be later than effective_from.")
