from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Budget, User


class BudgetUpdate(BaseModel):
    weekly_amount: Decimal
    name: str | None = None

    @field_validator("weekly_amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("weekly_amount must be positive")
        if v > Decimal("999999.99"):
            raise ValueError("weekly_amount cannot exceed 999999.99")
        exp = v.as_tuple().exponent
        if not isinstance(exp, int) or exp < -2:
            raise ValueError("weekly_amount cannot have more than 2 decimal places")
        return v

router = APIRouter(prefix="/api/v1/budget", tags=["budget"])


@router.get("")
async def get_budget(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Budget).where(Budget.user_id == current_user.id))
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    return {
        "data": {
            "id": str(budget.id),
            "name": budget.name,
            "weekly_amount": float(budget.weekly_amount),
        }
    }


@router.put("")
async def update_budget(
    body: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Budget).where(Budget.user_id == current_user.id))
    budget = result.scalar_one_or_none()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    budget.weekly_amount = body.weekly_amount

    if body.name is not None:
        budget.name = body.name

    db.add(budget)
    await db.commit()
    return {
        "data": {
            "id": str(budget.id),
            "name": budget.name,
            "weekly_amount": float(budget.weekly_amount),
        },
        "warning": "Changing weekly budget affects all historical week calculations.",
    }
