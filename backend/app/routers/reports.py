import logging
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Entry, User
from app.utils.week import get_week_end, get_week_start

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/reports", tags=["reports"])

MAX_DATE_RANGE_DAYS = 400


@router.get("/summary")
async def get_summary(
    start: date,
    end: date,
    group_by: Literal["week"] | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Enforce date range bounds
    if end < start:
        raise HTTPException(status_code=400, detail="end must be >= start")
    if (end - start).days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Date range cannot exceed {MAX_DATE_RANGE_DAYS} days",
        )

    stmt = (
        select(Entry)
        .where(
            Entry.user_id == current_user.id,
            Entry.date >= start,
            Entry.date <= end,
        )
        .order_by(Entry.date.asc(), Entry.created_at.asc())
    )

    result = await db.execute(stmt)
    entries = result.scalars().all()

    def compute_summary(entry_list):
        total_spent = sum(
            (e.amount for e in entry_list if e.type == "expense"), Decimal(0)
        )
        total_credits = sum(
            (e.amount for e in entry_list if e.type == "credit"), Decimal(0)
        )
        logger.error("rhs 1")
        return {
            "total_spent": float(round(total_spent, 2)),
            "total_credits": float(round(total_credits, 2)),
            "net_spent": float(round(total_spent - total_credits, 2)),
        }

    if group_by == "week":
        # Group entries by week start
        week_map: dict[date, list[Entry]] = {}
        for entry in entries:
            ws = get_week_start(entry.date, current_user.week_start_day)
            week_map.setdefault(ws, []).append(entry)

        weeks = []
        for week_start_date in sorted(week_map.keys()):
            week_entries = week_map[week_start_date]
            week_end = get_week_end(week_start_date, current_user.week_start_day)
            summary = compute_summary(week_entries)
            weeks.append(
                {
                    "week_start": week_start_date.isoformat(),
                    "week_end": week_end.isoformat(),
                    "entries": [
                        {
                            "id": str(e.id),
                            "amount": float(e.amount),
                            "type": e.type,
                            "memo": e.memo,
                            "date": e.date.isoformat(),
                        }
                        for e in week_entries
                    ],
                    **summary,
                }
            )

        overall = compute_summary(entries)
        logger.error("rhs 2")
        return {
            "data": {
                **overall,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "weeks": weeks,
            }
        }

    overall = compute_summary(entries)
    ret = {
        "data": {
            **overall,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "entries": [
                {
                    "id": str(e.id),
                    "amount": float(e.amount),
                    "type": e.type,
                    "memo": e.memo,
                    "date": e.date.isoformat(),
                }
                for e in entries
            ],
        }
    }
    logger.error(ret)
    return ret
