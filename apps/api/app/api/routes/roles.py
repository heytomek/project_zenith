from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from zenith_schemas.org_identity import RoleCreate, RoleRead, RoleUpdate

from app.api.dependencies import db_session_dependency
from app.services.identity_service import (
    create_role,
    delete_role,
    get_role,
    list_roles,
    update_role,
)

router = APIRouter(prefix="/roles")
DBSession = Annotated[Session, Depends(db_session_dependency)]


@router.get("", response_model=list[RoleRead])
def roles_index(session: DBSession) -> list[RoleRead]:
    return list_roles(session)


@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
def roles_create(payload: RoleCreate, session: DBSession) -> RoleRead:
    return create_role(session, payload)


@router.get("/{role_id}", response_model=RoleRead)
def roles_get(role_id: UUID, session: DBSession) -> RoleRead:
    return get_role(session, role_id)


@router.patch("/{role_id}", response_model=RoleRead)
def roles_update(role_id: UUID, payload: RoleUpdate, session: DBSession) -> RoleRead:
    return update_role(session, role_id, payload)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def roles_delete(role_id: UUID, session: DBSession) -> Response:
    delete_role(session, role_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
