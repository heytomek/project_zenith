from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ServiceLevelPolicyBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    scope: str = Field(default="work_order", min_length=1, max_length=64)
    target_minutes: int = Field(gt=0)
    description: str | None = None
    status: str = Field(default="active", min_length=1, max_length=32)


class ServiceLevelPolicyCreate(ServiceLevelPolicyBase):
    pass


class ServiceLevelPolicyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    scope: str | None = Field(default=None, min_length=1, max_length=64)
    target_minutes: int | None = Field(default=None, gt=0)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class ServiceLevelPolicyRead(ServiceLevelPolicyBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class ServiceLevelPolicySummary(ORMModel):
    id: UUID
    name: str
    target_minutes: int


class WorkOrderBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: str = Field(default="open", min_length=1, max_length=32)
    priority: int = Field(default=0, ge=0, le=100)
    requested_start_at: datetime | None = None
    due_at: datetime | None = None
    location_id: UUID
    planning_unit_id: UUID | None = None
    service_level_policy_id: UUID | None = None


class WorkOrderCreate(WorkOrderBase):
    pass


class WorkOrderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)
    priority: int | None = Field(default=None, ge=0, le=100)
    requested_start_at: datetime | None = None
    due_at: datetime | None = None
    location_id: UUID | None = None
    planning_unit_id: UUID | None = None
    service_level_policy_id: UUID | None = None


class WorkOrderRead(WorkOrderBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class WorkOrderSummary(ORMModel):
    id: UUID
    title: str
    status: str
    priority: int


class WorkRequirementBase(BaseModel):
    requirement_type: str = Field(min_length=1, max_length=64)
    reference_id: UUID | None = None
    min_level: int | None = Field(default=None, ge=1, le=5)
    quantity: int = Field(default=1, ge=1)
    notes: str | None = None


class WorkRequirementCreate(WorkRequirementBase):
    pass


class WorkRequirementUpdate(BaseModel):
    requirement_type: str | None = Field(default=None, min_length=1, max_length=64)
    reference_id: UUID | None = None
    min_level: int | None = Field(default=None, ge=1, le=5)
    quantity: int | None = Field(default=None, ge=1)
    notes: str | None = None


class WorkRequirementRead(WorkRequirementBase, ORMModel):
    id: UUID
    work_order_id: UUID
    created_at: datetime
    updated_at: datetime


class WorkOrderDependencyBase(BaseModel):
    predecessor_work_order_id: UUID
    successor_work_order_id: UUID
    dependency_type: str = Field(default="finish_to_start", min_length=1, max_length=64)


class WorkOrderDependencyCreate(WorkOrderDependencyBase):
    pass


class WorkOrderDependencyUpdate(BaseModel):
    predecessor_work_order_id: UUID | None = None
    successor_work_order_id: UUID | None = None
    dependency_type: str | None = Field(default=None, min_length=1, max_length=64)


class WorkOrderDependencyRead(WorkOrderDependencyBase, ORMModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
