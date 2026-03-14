"""
Budget endpoint tests.
"""
import uuid
import pytest
from httpx import AsyncClient
import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Budget
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


_CSRF_TOKEN = "test-csrf-token"


def _auth_cookie(user_id: uuid.UUID) -> dict:
    token = jwt.encode({"sub": str(user_id)}, settings.JWT_SECRET, algorithm="HS256")
    return {"access_token": token}


def _auth_cookies_with_csrf(user_id: uuid.UUID) -> dict:
    return {**_auth_cookie(user_id), "csrf_token": _CSRF_TOKEN}


def _csrf_header() -> dict:
    return {"X-CSRF-Token": _CSRF_TOKEN}


@pytest.mark.asyncio
async def test_get_budget(client: AsyncClient, db_session: AsyncSession):
    """GET /budget returns the authenticated user's budget."""
    user, budget = await _create_user_with_budget(db_session)
    resp = await client.get("/api/v1/budget", cookies=_auth_cookie(user.id))
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == str(budget.id)
    assert data["weekly_amount"] == 200.0


@pytest.mark.asyncio
async def test_update_budget(client: AsyncClient, db_session: AsyncSession):
    """PUT /budget updates weekly_amount."""
    user, budget = await _create_user_with_budget(db_session)
    resp = await client.put(
        "/api/v1/budget",
        json={"weekly_amount": 350.00},
        cookies=_auth_cookies_with_csrf(user.id),
        headers=_csrf_header(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["weekly_amount"] == 350.0


@pytest.mark.asyncio
async def test_update_budget_negative_rejected(client: AsyncClient, db_session: AsyncSession):
    """PUT /budget with non-positive weekly_amount must return 400/422."""
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.put(
        "/api/v1/budget",
        json={"weekly_amount": -50},
        cookies=_auth_cookies_with_csrf(user.id),
        headers=_csrf_header(),
    )
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_update_budget_zero_rejected(client: AsyncClient, db_session: AsyncSession):
    """PUT /budget with weekly_amount=0 must return 400/422."""
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.put(
        "/api/v1/budget",
        json={"weekly_amount": 0},
        cookies=_auth_cookies_with_csrf(user.id),
        headers=_csrf_header(),
    )
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_get_budget_unauthenticated(client: AsyncClient, db_session: AsyncSession):
    """GET /budget without auth must return 401."""
    resp = await client.get("/api/v1/budget")
    assert resp.status_code == 401
