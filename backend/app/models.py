import uuid
from datetime import date as DateType
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("week_start_day >= 0 AND week_start_day <= 6", name="ck_users_week_start_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    google_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    week_start_day: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    budget: Mapped["Budget"] = relationship(
        "Budget", back_populates="user", lazy="raise",
        cascade="all, delete-orphan", passive_deletes=True
    )
    entries: Mapped[list["Entry"]] = relationship(
        "Entry", back_populates="user", lazy="raise",
        cascade="all, delete-orphan", passive_deletes=True
    )


class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("user_id", name="uq_budgets_user_id"),
        CheckConstraint("weekly_amount > 0", name="ck_budgets_weekly_amount_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), default="Weekly Budget", nullable=False)
    weekly_amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), default=Decimal("100.00"), nullable=False)

    user: Mapped[User] = relationship("User", back_populates="budget", lazy="raise")


class Entry(Base):
    __tablename__ = "entries"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_entries_amount_positive"),
        CheckConstraint("type IN ('expense', 'credit')", name="ck_entries_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    budget_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=2), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[DateType] = mapped_column(Date, nullable=False)

    user: Mapped[User] = relationship("User", back_populates="entries", lazy="raise")
    budget: Mapped[Budget] = relationship("Budget", lazy="raise")
