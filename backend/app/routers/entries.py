import uuid
import datetime
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Budget, Entry, User


class EntryCreate(BaseModel):
    amount: Decimal
    type: Literal["expense", "credit"]
    date: datetime.date
    memo: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        if v > Decimal("999999.99"):
            raise ValueError("amount cannot exceed 999999.99")
        if v.as_tuple().exponent < -2:
            raise ValueError("amount cannot have more than 2 decimal places")
        return v


class EntryUpdate(BaseModel):
    amount: Decimal | None = None
    type: Literal["expense", "credit"] | None = None
    date: datetime.date | None = None
    memo: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return v
        if v <= 0:
            raise ValueError("amount must be positive")
        if v > Decimal("999999.99"):
            raise ValueError("amount cannot exceed 999999.99")
        if v.as_tuple().exponent < -2:
            raise ValueError("amount cannot have more than 2 decimal places")
        return v

router = APIRouter(prefix="/api/v1/entries", tags=["entries"])


async def _get_user_budget_id(db: AsyncSession, user_id: uuid.UUID) -> uuid.UUID:
    """Resolve budget_id server-side — never accept from client."""
    result = await db.execute(select(Budget.id).where(Budget.user_id == user_id))
    budget_id = result.scalar_one_or_none()
    if not budget_id:
        raise HTTPException(status_code=404, detail="No budget found for user")
    return budget_id


def entry_to_dict(entry: Entry) -> dict:
    return {
        "id": str(entry.id),
        "budget_id": str(entry.budget_id),
        "amount": float(entry.amount),
        "type": entry.type,
        "memo": entry.memo,
        "date": entry.date.isoformat(),
    }


@router.get("")
async def list_entries(
    start: datetime.date | None = None,
    end: datetime.date | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Mandatory user filter — always applied before any other condition
    stmt = select(Entry).where(Entry.user_id == current_user.id)

    if start:
        stmt = stmt.where(Entry.date >= start)
    if end:
        stmt = stmt.where(Entry.date <= end)

    stmt = stmt.order_by(Entry.date.asc(), Entry.id.asc())

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    entries = result.scalars().all()

    return {
        "data": [entry_to_dict(e) for e in entries],
        "pagination": {"limit": limit, "offset": offset, "total_count": total},
    }


@router.post("")
async def create_entry(
    body: EntryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Resolve budget_id server-side — NEVER accept from client
    budget_id = await _get_user_budget_id(db, current_user.id)

    entry = Entry(
        user_id=current_user.id,
        budget_id=budget_id,
        amount=body.amount,
        type=body.type,
        memo=body.memo,
        date=body.date,
    )
    db.add(entry)
    await db.commit()
    return {"data": entry_to_dict(entry)}


@router.put("/{entry_id}")
async def update_entry(
    entry_id: uuid.UUID,
    body: EntryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Entry).where(Entry.id == entry_id, Entry.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if body.amount is not None:
        entry.amount = body.amount

    if body.type is not None:
        entry.type = body.type

    if body.memo is not None:
        entry.memo = body.memo

    if body.date is not None:
        entry.date = body.date

    db.add(entry)
    await db.commit()
    return {"data": entry_to_dict(entry)}


@router.delete("/{entry_id}")
async def delete_entry(
    entry_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Entry).where(Entry.id == entry_id, Entry.user_id == current_user.id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    await db.delete(entry)
    await db.commit()
    return {"data": {"ok": True}}
