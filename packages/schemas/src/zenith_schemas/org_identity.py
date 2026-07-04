from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RoleBase(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class RoleCreate(RoleBase):
    pass


class RoleUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class RoleRead(RoleBase, ORMModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class RoleSummary(ORMModel):
    id: UUID
    code: str
    name: str


class OrganizationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=100)
    organization_type: str = Field(default="organization", min_length=1, max_length=50)
    status: str = Field(default="active", min_length=1, max_length=32)


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    organization_type: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = Field(default=None, min_length=1, max_length=32)


class OrganizationRead(OrganizationBase, ORMModel):
    id: UUID
    created_at: datetime
    updated_at: datetime


class PlanningUnitBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    unit_type: str = Field(default="team", min_length=1, max_length=50)
    status: str = Field(default="active", min_length=1, max_length=32)
    parent_unit_id: UUID | None = None


class PlanningUnitCreate(PlanningUnitBase):
    pass


class PlanningUnitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    unit_type: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    parent_unit_id: UUID | None = None


class PlanningUnitRead(PlanningUnitBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class LocationBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=64)
    location_type: str = Field(default="site", min_length=1, max_length=50)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    latitude: float | None = None
    longitude: float | None = None
    status: str = Field(default="active", min_length=1, max_length=32)


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=64)
    location_type: str | None = Field(default=None, min_length=1, max_length=50)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    latitude: float | None = None
    longitude: float | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class LocationRead(LocationBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class UserBase(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    display_name: str = Field(min_length=1, max_length=255)
    status: str = Field(default="active", min_length=1, max_length=32)
    role_ids: list[UUID] = Field(default_factory=list)


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    email: str | None = Field(default=None, min_length=3, max_length=255)
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    role_ids: list[UUID] | None = None


class UserRead(ORMModel):
    id: UUID
    organization_id: UUID
    email: str
    display_name: str
    status: str
    roles: list[RoleSummary]
    created_at: datetime
    updated_at: datetime
