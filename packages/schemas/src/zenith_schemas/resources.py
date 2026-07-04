from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MaterialBase(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    unit_of_measure: str = Field(default="unit", min_length=1, max_length=32)
    material_type: str = Field(default="general", min_length=1, max_length=64)
    description: str | None = None
    status: str = Field(default="active", min_length=1, max_length=32)


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    unit_of_measure: str | None = Field(default=None, min_length=1, max_length=32)
    material_type: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class MaterialRead(MaterialBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class MaterialSummary(ORMModel):
    id: UUID
    sku: str
    name: str


class InventoryPositionBase(BaseModel):
    material_id: UUID
    location_id: UUID
    on_hand_quantity: int = Field(ge=0)
    reserved_quantity: int = Field(default=0, ge=0)


class InventoryPositionCreate(InventoryPositionBase):
    pass


class InventoryPositionUpdate(BaseModel):
    on_hand_quantity: int | None = Field(default=None, ge=0)
    reserved_quantity: int | None = Field(default=None, ge=0)


class InventoryPositionRead(ORMModel):
    id: UUID
    material_id: UUID
    location_id: UUID
    on_hand_quantity: int
    reserved_quantity: int
    material: MaterialSummary
    created_at: datetime
    updated_at: datetime


class EquipmentTypeBase(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(default="general", min_length=1, max_length=64)
    description: str | None = None
    status: str = Field(default="active", min_length=1, max_length=32)


class EquipmentTypeCreate(EquipmentTypeBase):
    pass


class EquipmentTypeUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=64)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class EquipmentTypeRead(EquipmentTypeBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class EquipmentTypeSummary(ORMModel):
    id: UUID
    code: str
    name: str


class EquipmentBase(BaseModel):
    equipment_type_id: UUID
    location_id: UUID
    equipment_code: str = Field(min_length=1, max_length=64)
    serial_number: str | None = Field(default=None, max_length=128)
    status: str = Field(default="active", min_length=1, max_length=32)


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    equipment_type_id: UUID | None = None
    location_id: UUID | None = None
    equipment_code: str | None = Field(default=None, min_length=1, max_length=64)
    serial_number: str | None = Field(default=None, max_length=128)
    status: str | None = Field(default=None, min_length=1, max_length=32)


class EquipmentRead(ORMModel):
    id: UUID
    organization_id: UUID
    equipment_type_id: UUID
    location_id: UUID
    equipment_code: str
    serial_number: str | None
    status: str
    equipment_type: EquipmentTypeSummary
    created_at: datetime
    updated_at: datetime


class EquipmentAvailabilityCalendarBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    status: str = Field(default="active", min_length=1, max_length=32)


class EquipmentAvailabilityCalendarCreate(EquipmentAvailabilityCalendarBase):
    pass


class EquipmentAvailabilityCalendarUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class EquipmentAvailabilityCalendarRead(EquipmentAvailabilityCalendarBase, ORMModel):
    id: UUID
    equipment_id: UUID
    created_at: datetime
    updated_at: datetime


class EquipmentAvailabilityWindowBase(BaseModel):
    start_at: datetime
    end_at: datetime
    availability_type: str = Field(min_length=1, max_length=32)


class EquipmentAvailabilityWindowCreate(EquipmentAvailabilityWindowBase):
    pass


class EquipmentAvailabilityWindowUpdate(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    availability_type: str | None = Field(default=None, min_length=1, max_length=32)


class EquipmentAvailabilityWindowRead(EquipmentAvailabilityWindowBase, ORMModel):
    id: UUID
    calendar_id: UUID
    created_at: datetime
    updated_at: datetime
