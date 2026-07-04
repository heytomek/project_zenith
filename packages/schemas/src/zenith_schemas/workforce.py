from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SkillBase(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    category: str = Field(default="general", min_length=1, max_length=64)
    status: str = Field(default="active", min_length=1, max_length=32)


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, min_length=1, max_length=64)
    status: str | None = Field(default=None, min_length=1, max_length=32)


class SkillRead(SkillBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class SkillSummary(ORMModel):
    id: UUID
    code: str
    name: str


class CertificationBase(BaseModel):
    code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    expires: bool = True
    status: str = Field(default="active", min_length=1, max_length=32)


class CertificationCreate(CertificationBase):
    pass


class CertificationUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    expires: bool | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class CertificationRead(CertificationBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class CertificationSummary(ORMModel):
    id: UUID
    code: str
    name: str


class WorkerBase(BaseModel):
    worker_code: str = Field(min_length=1, max_length=64)
    display_name: str = Field(min_length=1, max_length=255)
    employment_type: str = Field(default="full_time", min_length=1, max_length=50)
    status: str = Field(default="active", min_length=1, max_length=32)
    home_location_id: UUID | None = None
    home_planning_unit_id: UUID | None = None


class WorkerCreate(WorkerBase):
    pass


class WorkerUpdate(BaseModel):
    worker_code: str | None = Field(default=None, min_length=1, max_length=64)
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    employment_type: str | None = Field(default=None, min_length=1, max_length=50)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    home_location_id: UUID | None = None
    home_planning_unit_id: UUID | None = None


class WorkerRead(WorkerBase, ORMModel):
    id: UUID
    organization_id: UUID
    created_at: datetime
    updated_at: datetime


class WorkerSkillBase(BaseModel):
    skill_id: UUID
    proficiency_level: int = Field(default=1, ge=1, le=5)
    verified: bool = False
    source: str | None = Field(default=None, max_length=255)


class WorkerSkillCreate(WorkerSkillBase):
    pass


class WorkerSkillUpdate(BaseModel):
    proficiency_level: int | None = Field(default=None, ge=1, le=5)
    verified: bool | None = None
    source: str | None = Field(default=None, max_length=255)


class WorkerSkillRead(ORMModel):
    id: UUID
    worker_id: UUID
    skill_id: UUID
    proficiency_level: int
    verified: bool
    source: str | None
    skill: SkillSummary
    created_at: datetime
    updated_at: datetime


class WorkerCertificationBase(BaseModel):
    certification_id: UUID
    status: str = Field(default="active", min_length=1, max_length=32)
    issued_at: datetime | None = None
    expires_at: datetime | None = None


class WorkerCertificationCreate(WorkerCertificationBase):
    pass


class WorkerCertificationUpdate(BaseModel):
    status: str | None = Field(default=None, min_length=1, max_length=32)
    issued_at: datetime | None = None
    expires_at: datetime | None = None


class WorkerCertificationRead(ORMModel):
    id: UUID
    worker_id: UUID
    certification_id: UUID
    status: str
    issued_at: datetime | None
    expires_at: datetime | None
    certification: CertificationSummary
    created_at: datetime
    updated_at: datetime


class AvailabilityCalendarBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    status: str = Field(default="active", min_length=1, max_length=32)


class AvailabilityCalendarCreate(AvailabilityCalendarBase):
    pass


class AvailabilityCalendarUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class AvailabilityCalendarRead(AvailabilityCalendarBase, ORMModel):
    id: UUID
    worker_id: UUID
    created_at: datetime
    updated_at: datetime


class AvailabilityWindowBase(BaseModel):
    start_at: datetime
    end_at: datetime
    availability_type: str = Field(min_length=1, max_length=32)


class AvailabilityWindowCreate(AvailabilityWindowBase):
    pass


class AvailabilityWindowUpdate(BaseModel):
    start_at: datetime | None = None
    end_at: datetime | None = None
    availability_type: str | None = Field(default=None, min_length=1, max_length=32)


class AvailabilityWindowRead(AvailabilityWindowBase, ORMModel):
    id: UUID
    calendar_id: UUID
    created_at: datetime
    updated_at: datetime


class WorkerShiftTemplateBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    timezone: str = Field(default="UTC", min_length=1, max_length=64)
    day_of_week: int = Field(ge=0, le=6)
    start_minute_local: int = Field(ge=0, le=1439)
    end_minute_local: int = Field(ge=0, le=1439)
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    status: str = Field(default="active", min_length=1, max_length=32)


class WorkerShiftTemplateCreate(WorkerShiftTemplateBase):
    pass


class WorkerShiftTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    timezone: str | None = Field(default=None, min_length=1, max_length=64)
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    start_minute_local: int | None = Field(default=None, ge=0, le=1439)
    end_minute_local: int | None = Field(default=None, ge=0, le=1439)
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)


class WorkerShiftTemplateRead(WorkerShiftTemplateBase, ORMModel):
    id: UUID
    worker_id: UUID
    created_at: datetime
    updated_at: datetime


class WorkerShiftBreakRuleBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    start_minute_local: int = Field(ge=0, le=1439)
    duration_minutes: int = Field(ge=1, le=720)
    status: str = Field(default="active", min_length=1, max_length=32)


class WorkerShiftBreakRuleCreate(WorkerShiftBreakRuleBase):
    pass


class WorkerShiftBreakRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    start_minute_local: int | None = Field(default=None, ge=0, le=1439)
    duration_minutes: int | None = Field(default=None, ge=1, le=720)
    status: str | None = Field(default=None, min_length=1, max_length=32)


class WorkerShiftBreakRuleRead(WorkerShiftBreakRuleBase, ORMModel):
    id: UUID
    shift_template_id: UUID
    created_at: datetime
    updated_at: datetime
