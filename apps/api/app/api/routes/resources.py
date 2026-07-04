from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from zenith_schemas.resources import (
    EquipmentAvailabilityCalendarCreate,
    EquipmentAvailabilityCalendarRead,
    EquipmentAvailabilityCalendarUpdate,
    EquipmentAvailabilityWindowCreate,
    EquipmentAvailabilityWindowRead,
    EquipmentAvailabilityWindowUpdate,
    EquipmentCreate,
    EquipmentRead,
    EquipmentTypeCreate,
    EquipmentTypeRead,
    EquipmentTypeUpdate,
    EquipmentUpdate,
    InventoryPositionCreate,
    InventoryPositionRead,
    InventoryPositionUpdate,
    MaterialCreate,
    MaterialRead,
    MaterialUpdate,
)

from app.api.dependencies import db_session_dependency
from app.services.resource_service import (
    create_equipment,
    create_equipment_availability_calendar,
    create_equipment_availability_window,
    create_equipment_type,
    create_inventory_position,
    create_material,
    delete_equipment,
    delete_equipment_availability_calendar,
    delete_equipment_availability_window,
    delete_equipment_type,
    delete_inventory_position,
    delete_material,
    get_equipment,
    get_equipment_availability_calendar,
    get_equipment_availability_window,
    get_equipment_type,
    get_inventory_position,
    get_material,
    list_equipment,
    list_equipment_availability_calendars,
    list_equipment_availability_windows,
    list_equipment_types,
    list_inventory_positions,
    list_materials,
    update_equipment,
    update_equipment_availability_calendar,
    update_equipment_availability_window,
    update_equipment_type,
    update_inventory_position,
    update_material,
)

router = APIRouter(prefix="/organizations/{organization_id}")
DBSession = Annotated[Session, Depends(db_session_dependency)]


@router.get("/materials", response_model=list[MaterialRead])
def materials_index(organization_id: UUID, session: DBSession) -> list[MaterialRead]:
    return list_materials(session, organization_id)


@router.post("/materials", response_model=MaterialRead, status_code=status.HTTP_201_CREATED)
def materials_create(
    organization_id: UUID,
    payload: MaterialCreate,
    session: DBSession,
) -> MaterialRead:
    return create_material(session, organization_id, payload)


@router.get("/materials/{material_id}", response_model=MaterialRead)
def materials_get(organization_id: UUID, material_id: UUID, session: DBSession) -> MaterialRead:
    return get_material(session, organization_id, material_id)


@router.patch("/materials/{material_id}", response_model=MaterialRead)
def materials_update(
    organization_id: UUID,
    material_id: UUID,
    payload: MaterialUpdate,
    session: DBSession,
) -> MaterialRead:
    return update_material(session, organization_id, material_id, payload)


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
def materials_delete(organization_id: UUID, material_id: UUID, session: DBSession) -> Response:
    delete_material(session, organization_id, material_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/inventory-positions", response_model=list[InventoryPositionRead])
def inventory_positions_index(
    organization_id: UUID,
    session: DBSession,
) -> list[InventoryPositionRead]:
    return list_inventory_positions(session, organization_id)


@router.post(
    "/inventory-positions",
    response_model=InventoryPositionRead,
    status_code=status.HTTP_201_CREATED,
)
def inventory_positions_create(
    organization_id: UUID,
    payload: InventoryPositionCreate,
    session: DBSession,
) -> InventoryPositionRead:
    return create_inventory_position(session, organization_id, payload)


@router.get("/inventory-positions/{inventory_position_id}", response_model=InventoryPositionRead)
def inventory_positions_get(
    organization_id: UUID,
    inventory_position_id: UUID,
    session: DBSession,
) -> InventoryPositionRead:
    return get_inventory_position(session, organization_id, inventory_position_id)


@router.patch("/inventory-positions/{inventory_position_id}", response_model=InventoryPositionRead)
def inventory_positions_update(
    organization_id: UUID,
    inventory_position_id: UUID,
    payload: InventoryPositionUpdate,
    session: DBSession,
) -> InventoryPositionRead:
    return update_inventory_position(session, organization_id, inventory_position_id, payload)


@router.delete("/inventory-positions/{inventory_position_id}", status_code=status.HTTP_204_NO_CONTENT)
def inventory_positions_delete(
    organization_id: UUID,
    inventory_position_id: UUID,
    session: DBSession,
) -> Response:
    delete_inventory_position(session, organization_id, inventory_position_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/equipment-types", response_model=list[EquipmentTypeRead])
def equipment_types_index(organization_id: UUID, session: DBSession) -> list[EquipmentTypeRead]:
    return list_equipment_types(session, organization_id)


@router.post(
    "/equipment-types",
    response_model=EquipmentTypeRead,
    status_code=status.HTTP_201_CREATED,
)
def equipment_types_create(
    organization_id: UUID,
    payload: EquipmentTypeCreate,
    session: DBSession,
) -> EquipmentTypeRead:
    return create_equipment_type(session, organization_id, payload)


@router.get("/equipment-types/{equipment_type_id}", response_model=EquipmentTypeRead)
def equipment_types_get(
    organization_id: UUID,
    equipment_type_id: UUID,
    session: DBSession,
) -> EquipmentTypeRead:
    return get_equipment_type(session, organization_id, equipment_type_id)


@router.patch("/equipment-types/{equipment_type_id}", response_model=EquipmentTypeRead)
def equipment_types_update(
    organization_id: UUID,
    equipment_type_id: UUID,
    payload: EquipmentTypeUpdate,
    session: DBSession,
) -> EquipmentTypeRead:
    return update_equipment_type(session, organization_id, equipment_type_id, payload)


@router.delete("/equipment-types/{equipment_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def equipment_types_delete(
    organization_id: UUID,
    equipment_type_id: UUID,
    session: DBSession,
) -> Response:
    delete_equipment_type(session, organization_id, equipment_type_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/equipment", response_model=list[EquipmentRead])
def equipment_index(organization_id: UUID, session: DBSession) -> list[EquipmentRead]:
    return list_equipment(session, organization_id)


@router.post("/equipment", response_model=EquipmentRead, status_code=status.HTTP_201_CREATED)
def equipment_create(
    organization_id: UUID,
    payload: EquipmentCreate,
    session: DBSession,
) -> EquipmentRead:
    return create_equipment(session, organization_id, payload)


@router.get("/equipment/{equipment_id}", response_model=EquipmentRead)
def equipment_get(organization_id: UUID, equipment_id: UUID, session: DBSession) -> EquipmentRead:
    return get_equipment(session, organization_id, equipment_id)


@router.patch("/equipment/{equipment_id}", response_model=EquipmentRead)
def equipment_update(
    organization_id: UUID,
    equipment_id: UUID,
    payload: EquipmentUpdate,
    session: DBSession,
) -> EquipmentRead:
    return update_equipment(session, organization_id, equipment_id, payload)


@router.delete("/equipment/{equipment_id}", status_code=status.HTTP_204_NO_CONTENT)
def equipment_delete(organization_id: UUID, equipment_id: UUID, session: DBSession) -> Response:
    delete_equipment(session, organization_id, equipment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/equipment/{equipment_id}/availability-calendars",
    response_model=list[EquipmentAvailabilityCalendarRead],
)
def equipment_availability_calendars_index(
    organization_id: UUID,
    equipment_id: UUID,
    session: DBSession,
) -> list[EquipmentAvailabilityCalendarRead]:
    return list_equipment_availability_calendars(session, organization_id, equipment_id)


@router.post(
    "/equipment/{equipment_id}/availability-calendars",
    response_model=EquipmentAvailabilityCalendarRead,
    status_code=status.HTTP_201_CREATED,
)
def equipment_availability_calendars_create(
    organization_id: UUID,
    equipment_id: UUID,
    payload: EquipmentAvailabilityCalendarCreate,
    session: DBSession,
) -> EquipmentAvailabilityCalendarRead:
    return create_equipment_availability_calendar(session, organization_id, equipment_id, payload)


@router.get(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}",
    response_model=EquipmentAvailabilityCalendarRead,
)
def equipment_availability_calendars_get(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    session: DBSession,
) -> EquipmentAvailabilityCalendarRead:
    return get_equipment_availability_calendar(session, organization_id, equipment_id, calendar_id)


@router.patch(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}",
    response_model=EquipmentAvailabilityCalendarRead,
)
def equipment_availability_calendars_update(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    payload: EquipmentAvailabilityCalendarUpdate,
    session: DBSession,
) -> EquipmentAvailabilityCalendarRead:
    return update_equipment_availability_calendar(
        session,
        organization_id,
        equipment_id,
        calendar_id,
        payload,
    )


@router.delete(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def equipment_availability_calendars_delete(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    session: DBSession,
) -> Response:
    delete_equipment_availability_calendar(session, organization_id, equipment_id, calendar_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}/windows",
    response_model=list[EquipmentAvailabilityWindowRead],
)
def equipment_availability_windows_index(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    session: DBSession,
) -> list[EquipmentAvailabilityWindowRead]:
    return list_equipment_availability_windows(session, organization_id, equipment_id, calendar_id)


@router.post(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}/windows",
    response_model=EquipmentAvailabilityWindowRead,
    status_code=status.HTTP_201_CREATED,
)
def equipment_availability_windows_create(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    payload: EquipmentAvailabilityWindowCreate,
    session: DBSession,
) -> EquipmentAvailabilityWindowRead:
    return create_equipment_availability_window(
        session,
        organization_id,
        equipment_id,
        calendar_id,
        payload,
    )


@router.get(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}/windows/{window_id}",
    response_model=EquipmentAvailabilityWindowRead,
)
def equipment_availability_windows_get(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
    session: DBSession,
) -> EquipmentAvailabilityWindowRead:
    return get_equipment_availability_window(
        session,
        organization_id,
        equipment_id,
        calendar_id,
        window_id,
    )


@router.patch(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}/windows/{window_id}",
    response_model=EquipmentAvailabilityWindowRead,
)
def equipment_availability_windows_update(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
    payload: EquipmentAvailabilityWindowUpdate,
    session: DBSession,
) -> EquipmentAvailabilityWindowRead:
    return update_equipment_availability_window(
        session,
        organization_id,
        equipment_id,
        calendar_id,
        window_id,
        payload,
    )


@router.delete(
    "/equipment/{equipment_id}/availability-calendars/{calendar_id}/windows/{window_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def equipment_availability_windows_delete(
    organization_id: UUID,
    equipment_id: UUID,
    calendar_id: UUID,
    window_id: UUID,
    session: DBSession,
) -> Response:
    delete_equipment_availability_window(
        session,
        organization_id,
        equipment_id,
        calendar_id,
        window_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
