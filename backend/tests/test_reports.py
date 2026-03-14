"""
Reports endpoint tests.
Covers date validation, group_by enforcement, and data isolation.
"""
import uuid
import pytest
from datetime import date
from httpx import AsyncClient
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Budget, Entry
from app.config import settings


async def _create_user_with_budget(db: AsyncSession) -> tuple[User, Budget]:
    user = User(
        email=f"test_{uuid.uuid4().hex[:8]}@example.com",
        name="Test User",
        google_id=f"google_{uuid.uuid4().hex}",
        week_start_day=0,
    )
    db.add(user)
    await db.flush()
    budget = Budget(user_id=user.id, weekly_amount=200)
    db.add(budget)
    await db.flush()
    await db.commit()
    return user, budget


def _auth_cookie(user_id: uuid.UUID) -> dict:
    token = jwt.encode({"sub": str(user_id)}, settings.JWT_SECRET, algorithm="HS256")
    return {"access_token": token}


@pytest.mark.asyncio
async def test_reports_end_before_start_rejected(client: AsyncClient, db_session: AsyncSession):
    """end < start must return 400 before computing (end - start).days."""
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.get(
        "/api/v1/reports/summary",
        params={"start": "2026-03-10", "end": "2026-03-01"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 400
    assert "end must be" in resp.json()["error"]["message"].lower()


@pytest.mark.asyncio
async def test_reports_range_too_large_rejected(client: AsyncClient, db_session: AsyncSession):
    """Date ranges exceeding MAX_DATE_RANGE_DAYS must return 400."""
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.get(
        "/api/v1/reports/summary",
        params={"start": "2024-01-01", "end": "2026-03-10"},  # > 400 days
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_reports_invalid_group_by_rejected(client: AsyncClient, db_session: AsyncSession):
    """group_by values other than 'week' must be rejected with 422."""
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.get(
        "/api/v1/reports/summary",
        params={"start": "2026-03-01", "end": "2026-03-07", "group_by": "month"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 400  # custom validation_handler in main.py converts 422 → 400


@pytest.mark.asyncio
async def test_reports_summary_flat(client: AsyncClient, db_session: AsyncSession):
    """Flat summary returns total_spent, total_credits, net_spent."""
    user, budget = await _create_user_with_budget(db_session)

    e1 = Entry(user_id=user.id, budget_id=budget.id, amount=30, type="expense", date=date(2026, 3, 2))
    e2 = Entry(user_id=user.id, budget_id=budget.id, amount=10, type="credit", date=date(2026, 3, 3))
    db_session.add_all([e1, e2])
    await db_session.commit()

    resp = await client.get(
        "/api/v1/reports/summary",
        params={"start": "2026-03-01", "end": "2026-03-07"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_spent"] == 30.0
    assert data["total_credits"] == 10.0
    assert data["net_spent"] == 20.0
    assert "entries" in data


@pytest.mark.asyncio
async def test_reports_summary_group_by_week(client: AsyncClient, db_session: AsyncSession):
    """group_by=week returns weeks list with per-week summaries."""
    user, budget = await _create_user_with_budget(db_session)

    # Two entries in the same week (Sun week_start_day=0)
    e1 = Entry(user_id=user.id, budget_id=budget.id, amount=50, type="expense", date=date(2026, 3, 2))
    e2 = Entry(user_id=user.id, budget_id=budget.id, amount=20, type="expense", date=date(2026, 3, 4))
    db_session.add_all([e1, e2])
    await db_session.commit()

    resp = await client.get(
        "/api/v1/reports/summary",
        params={"start": "2026-03-01", "end": "2026-03-07", "group_by": "week"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "weeks" in data
    assert len(data["weeks"]) >= 1
    week = data["weeks"][0]
    assert "week_start" in week
    assert "week_end" in week
    assert "total_spent" in week


@pytest.mark.asyncio
async def test_reports_only_own_entries(client: AsyncClient, db_session: AsyncSession):
    """Reports must only include the authenticated user's entries."""
    user1, budget1 = await _create_user_with_budget(db_session)
    user2, budget2 = await _create_user_with_budget(db_session)

    e1 = Entry(user_id=user1.id, budget_id=budget1.id, amount=100, type="expense", date=date(2026, 3, 2))
    e2 = Entry(user_id=user2.id, budget_id=budget2.id, amount=999, type="expense", date=date(2026, 3, 2))
    db_session.add_all([e1, e2])
    await db_session.commit()

    resp = await client.get(
        "/api/v1/reports/summary",
        params={"start": "2026-03-01", "end": "2026-03-07"},
        cookies=_auth_cookie(user1.id),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_spent"] == 100.0  # only user1's entry


@pytest.mark.asyncio
async def test_reports_empty_range(client: AsyncClient, db_session: AsyncSession):
    """Reports with no entries in range return zeros."""
    user, _ = await _create_user_with_budget(db_session)

    resp = await client.get(
        "/api/v1/reports/summary",
        params={"start": "2026-01-01", "end": "2026-01-31"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_spent"] == 0.0
    assert data["total_credits"] == 0.0
    assert data["net_spent"] == 0.0
