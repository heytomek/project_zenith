from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from app.db.models.organization import Organization


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    organization_id = mapped_column(ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    organization: Mapped["Organization"] = relationship(back_populates="users")
    role_assignments: Mapped[list["UserRole"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user_assignments: Mapped[list["UserRole"]] = relationship(back_populates="role")


class UserRole(TimestampMixin, Base):
    __tablename__ = "user_roles"
    __table_args__ = (
        UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_id_role_id"),
    )

    user_id = mapped_column(ForeignKey("users.id"), primary_key=True)
    role_id = mapped_column(ForeignKey("roles.id"), primary_key=True)

    user: Mapped["User"] = relationship(back_populates="role_assignments")
    role: Mapped["Role"] = relationship(back_populates="user_assignments")
