from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from zenith_schemas.org_identity import (
    LocationCreate,
    LocationRead,
    LocationUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    PlanningUnitCreate,
    PlanningUnitRead,
    PlanningUnitUpdate,
    UserCreate,
    UserRead,
    UserUpdate,
)

from app.api.dependencies import db_session_dependency
from app.services.identity_service import (
    create_user,
    delete_user,
    get_user,
    list_users,
    update_user,
)
from app.services.organization_service import (
    create_location,
    create_organization,
    create_planning_unit,
    delete_location,
    delete_organization,
    delete_planning_unit,
    get_location,
    get_organization,
    get_planning_unit,
    list_locations,
    list_organizations,
    list_planning_units,
    update_location,
    update_organization,
    update_planning_unit,
)

router = APIRouter(prefix="/organizations")
DBSession = Annotated[Session, Depends(db_session_dependency)]


@router.get("", response_model=list[OrganizationRead])
def organizations_index(session: DBSession) -> list[OrganizationRead]:
    return list_organizations(session)


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def organizations_create(payload: OrganizationCreate, session: DBSession) -> OrganizationRead:
    return create_organization(session, payload)


@router.get("/{organization_id}", response_model=OrganizationRead)
def organizations_get(organization_id: UUID, session: DBSession) -> OrganizationRead:
    return get_organization(session, organization_id)


@router.patch("/{organization_id}", response_model=OrganizationRead)
def organizations_update(
    organization_id: UUID, payload: OrganizationUpdate, session: DBSession
) -> OrganizationRead:
    return update_organization(session, organization_id, payload)


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
def organizations_delete(organization_id: UUID, session: DBSession) -> Response:
    delete_organization(session, organization_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{organization_id}/planning-units", response_model=list[PlanningUnitRead])
def planning_units_index(organization_id: UUID, session: DBSession) -> list[PlanningUnitRead]:
    return list_planning_units(session, organization_id)


@router.post(
    "/{organization_id}/planning-units",
    response_model=PlanningUnitRead,
    status_code=status.HTTP_201_CREATED,
)
def planning_units_create(
    organization_id: UUID, payload: PlanningUnitCreate, session: DBSession
) -> PlanningUnitRead:
    return create_planning_unit(session, organization_id, payload)


@router.get("/{organization_id}/planning-units/{planning_unit_id}", response_model=PlanningUnitRead)
def planning_units_get(
    organization_id: UUID, planning_unit_id: UUID, session: DBSession
) -> PlanningUnitRead:
    return get_planning_unit(session, organization_id, planning_unit_id)


@router.patch("/{organization_id}/planning-units/{planning_unit_id}", response_model=PlanningUnitRead)
def planning_units_update(
    organization_id: UUID,
    planning_unit_id: UUID,
    payload: PlanningUnitUpdate,
    session: DBSession,
) -> PlanningUnitRead:
    return update_planning_unit(session, organization_id, planning_unit_id, payload)


@router.delete(
    "/{organization_id}/planning-units/{planning_unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def planning_units_delete(
    organization_id: UUID, planning_unit_id: UUID, session: DBSession
) -> Response:
    delete_planning_unit(session, organization_id, planning_unit_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{organization_id}/locations", response_model=list[LocationRead])
def locations_index(organization_id: UUID, session: DBSession) -> list[LocationRead]:
    return list_locations(session, organization_id)


@router.post(
    "/{organization_id}/locations",
    response_model=LocationRead,
    status_code=status.HTTP_201_CREATED,
)
def locations_create(
    organization_id: UUID, payload: LocationCreate, session: DBSession
) -> LocationRead:
    return create_location(session, organization_id, payload)


@router.get("/{organization_id}/locations/{location_id}", response_model=LocationRead)
def locations_get(organization_id: UUID, location_id: UUID, session: DBSession) -> LocationRead:
    return get_location(session, organization_id, location_id)


@router.patch("/{organization_id}/locations/{location_id}", response_model=LocationRead)
def locations_update(
    organization_id: UUID,
    location_id: UUID,
    payload: LocationUpdate,
    session: DBSession,
) -> LocationRead:
    return update_location(session, organization_id, location_id, payload)


@router.delete("/{organization_id}/locations/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
def locations_delete(organization_id: UUID, location_id: UUID, session: DBSession) -> Response:
    delete_location(session, organization_id, location_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{organization_id}/users", response_model=list[UserRead])
def users_index(organization_id: UUID, session: DBSession) -> list[UserRead]:
    return [_serialize_user(user) for user in list_users(session, organization_id)]


@router.post("/{organization_id}/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def users_create(organization_id: UUID, payload: UserCreate, session: DBSession) -> UserRead:
    user = create_user(session, organization_id, payload)
    return _serialize_user(user)


@router.get("/{organization_id}/users/{user_id}", response_model=UserRead)
def users_get(organization_id: UUID, user_id: UUID, session: DBSession) -> UserRead:
    return _serialize_user(get_user(session, organization_id, user_id))


@router.patch("/{organization_id}/users/{user_id}", response_model=UserRead)
def users_update(
    organization_id: UUID, user_id: UUID, payload: UserUpdate, session: DBSession
) -> UserRead:
    user = update_user(session, organization_id, user_id, payload)
    return _serialize_user(user)


@router.delete("/{organization_id}/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def users_delete(organization_id: UUID, user_id: UUID, session: DBSession) -> Response:
    delete_user(session, organization_id, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _serialize_user(user) -> UserRead:
    return UserRead.model_validate(
        {
            "id": user.id,
            "organization_id": user.organization_id,
            "email": user.email,
            "display_name": user.display_name,
            "status": user.status,
            "roles": [assignment.role for assignment in user.role_assignments],
            "created_at": user.created_at,
            "updated_at": user.updated_at,
        }
    )
