from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from zenith_schemas.org_identity import RoleCreate, RoleUpdate, UserCreate, UserUpdate

from app.db.models.identity import Role, User, UserRole
from app.db.models.organization import Organization
from app.services.errors import ConflictError, NotFoundError, ValidationError


def list_roles(session: Session) -> list[Role]:
    return list(session.scalars(select(Role).order_by(Role.name.asc())))


def create_role(session: Session, payload: RoleCreate) -> Role:
    _ensure_unique_role_code(session, payload.code)
    role = Role(**payload.model_dump())
    session.add(role)
    session.commit()
    session.refresh(role)
    return role


def get_role(session: Session, role_id: UUID) -> Role:
    role = session.get(Role, role_id)
    if role is None:
        raise NotFoundError(f"Role {role_id} was not found.")
    return role


def update_role(session: Session, role_id: UUID, payload: RoleUpdate) -> Role:
    role = get_role(session, role_id)
    updates = payload.model_dump(exclude_unset=True)

    if "code" in updates and updates["code"] != role.code:
        _ensure_unique_role_code(session, updates["code"], exclude_id=role_id)

    for field, value in updates.items():
        setattr(role, field, value)

    session.commit()
    session.refresh(role)
    return role


def delete_role(session: Session, role_id: UUID) -> None:
    role = get_role(session, role_id)
    if role.user_assignments:
        raise ConflictError("Cannot delete a role that is still assigned to users.")
    session.delete(role)
    session.commit()


def list_users(session: Session, organization_id: UUID) -> list[User]:
    _require_organization(session, organization_id)
    query = (
        select(User)
        .options(selectinload(User.role_assignments).selectinload(UserRole.role))
        .where(User.organization_id == organization_id)
        .order_by(User.display_name.asc())
    )
    return list(session.scalars(query))


def create_user(session: Session, organization_id: UUID, payload: UserCreate) -> User:
    _require_organization(session, organization_id)
    _validate_email(payload.email)
    _ensure_unique_user_email(session, payload.email)
    roles = _get_roles(session, payload.role_ids)

    user = User(
        organization_id=organization_id,
        email=payload.email,
        display_name=payload.display_name,
        status=payload.status,
    )
    user.role_assignments = [UserRole(role=role) for role in roles]
    session.add(user)
    session.commit()
    session.refresh(user)
    return _load_user_with_roles(session, user.id)


def get_user(session: Session, organization_id: UUID, user_id: UUID) -> User:
    _require_organization(session, organization_id)
    user = _load_user_with_roles(session, user_id)
    if user is None or user.organization_id != organization_id:
        raise NotFoundError(f"User {user_id} was not found in organization {organization_id}.")
    return user


def update_user(session: Session, organization_id: UUID, user_id: UUID, payload: UserUpdate) -> User:
    user = get_user(session, organization_id, user_id)
    updates = payload.model_dump(exclude_unset=True)

    if "email" in updates:
        _validate_email(updates["email"])
        if updates["email"] != user.email:
            _ensure_unique_user_email(session, updates["email"], exclude_id=user_id)

    if "role_ids" in updates:
        roles = _get_roles(session, updates["role_ids"] or [])
        user.role_assignments.clear()
        user.role_assignments.extend(UserRole(role=role) for role in roles)

    for field, value in updates.items():
        if field == "role_ids":
            continue
        setattr(user, field, value)

    session.commit()
    return get_user(session, organization_id, user_id)


def delete_user(session: Session, organization_id: UUID, user_id: UUID) -> None:
    user = get_user(session, organization_id, user_id)
    session.delete(user)
    session.commit()


def _require_organization(session: Session, organization_id: UUID) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise NotFoundError(f"Organization {organization_id} was not found.")
    return organization


def _ensure_unique_role_code(
    session: Session, code: str, exclude_id: UUID | None = None
) -> None:
    query = select(Role).where(Role.code == code)
    if exclude_id is not None:
        query = query.where(Role.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"Role code '{code}' is already in use.")


def _ensure_unique_user_email(
    session: Session, email: str, exclude_id: UUID | None = None
) -> None:
    query = select(User).where(User.email == email)
    if exclude_id is not None:
        query = query.where(User.id != exclude_id)
    if session.scalar(query) is not None:
        raise ConflictError(f"User email '{email}' is already in use.")


def _get_roles(session: Session, role_ids: list[UUID]) -> list[Role]:
    if not role_ids:
        return []
    query = select(Role).where(Role.id.in_(role_ids)).order_by(Role.name.asc())
    roles = list(session.scalars(query))
    found_ids = {role.id for role in roles}
    missing = [role_id for role_id in role_ids if role_id not in found_ids]
    if missing:
        raise ValidationError(f"Unknown role ids: {', '.join(str(item) for item in missing)}.")
    role_map = {role.id: role for role in roles}
    return [role_map[role_id] for role_id in role_ids]


def _load_user_with_roles(session: Session, user_id: UUID) -> User | None:
    query = (
        select(User)
        .options(selectinload(User.role_assignments).selectinload(UserRole.role))
        .where(User.id == user_id)
    )
    return session.scalar(query)


def _validate_email(email: str) -> None:
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise ValidationError("A valid email address is required.")
