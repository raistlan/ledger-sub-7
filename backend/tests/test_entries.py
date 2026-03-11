"""
Entry CRUD tests.
Key invariant: budget_id is NEVER accepted from client — always resolved server-side.
"""
import uuid
import pytest
from datetime import date
from httpx import AsyncClient
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
async def test_create_entry_resolves_budget_server_side(client: AsyncClient, db_session: AsyncSession):
    """budget_id must never be accepted from client — always resolved server-side."""
    user, budget = await _create_user_with_budget(db_session)
    fake_budget_id = str(uuid.uuid4())

    resp = await client.post(
        "/api/v1/entries",
        json={
            "amount": 10.00,
            "type": "expense",
            "date": "2026-03-01",
            "budget_id": fake_budget_id,  # should be IGNORED
        },
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["budget_id"] == str(budget.id)  # server resolved, not client-supplied


@pytest.mark.asyncio
async def test_create_entry_negative_amount_rejected(client: AsyncClient, db_session: AsyncSession):
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.post(
        "/api/v1/entries",
        json={"amount": -5.00, "type": "expense", "date": "2026-03-01"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_entry_zero_amount_rejected(client: AsyncClient, db_session: AsyncSession):
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.post(
        "/api/v1/entries",
        json={"amount": 0, "type": "expense", "date": "2026-03-01"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_delete_entry_ownership(client: AsyncClient, db_session: AsyncSession):
    """User cannot delete entries belonging to another user."""
    user1, budget1 = await _create_user_with_budget(db_session)
    user2, _ = await _create_user_with_budget(db_session)

    # Create entry for user1
    entry = Entry(
        user_id=user1.id,
        budget_id=budget1.id,
        amount=25.00,
        type="expense",
        date=date(2026, 3, 1),
    )
    db_session.add(entry)
    await db_session.commit()

    # User2 tries to delete user1's entry
    resp = await client.delete(
        f"/api/v1/entries/{entry.id}",
        cookies=_auth_cookie(user2.id),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_entries_only_own(client: AsyncClient, db_session: AsyncSession):
    """Entry list must only show authenticated user's entries."""
    user1, budget1 = await _create_user_with_budget(db_session)
    user2, budget2 = await _create_user_with_budget(db_session)

    e1 = Entry(user_id=user1.id, budget_id=budget1.id, amount=10, type="expense", date=date(2026, 3, 1))
    e2 = Entry(user_id=user2.id, budget_id=budget2.id, amount=20, type="expense", date=date(2026, 3, 1))
    db_session.add_all([e1, e2])
    await db_session.commit()

    resp = await client.get("/api/v1/entries", cookies=_auth_cookie(user1.id))
    assert resp.status_code == 200
    ids = [e["id"] for e in resp.json()["data"]]
    assert str(e1.id) in ids
    assert str(e2.id) not in ids


@pytest.mark.asyncio
async def test_entry_invalid_type_rejected(client: AsyncClient, db_session: AsyncSession):
    user, _ = await _create_user_with_budget(db_session)
    resp = await client.post(
        "/api/v1/entries",
        json={"amount": 10, "type": "invalid_type", "date": "2026-03-01"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_update_entry(client: AsyncClient, db_session: AsyncSession):
    """PUT /entries/{id} updates fields and returns updated entry."""
    user, budget = await _create_user_with_budget(db_session)
    entry = Entry(
        user_id=user.id,
        budget_id=budget.id,
        amount=15.00,
        type="expense",
        date=date(2026, 3, 1),
    )
    db_session.add(entry)
    await db_session.commit()

    resp = await client.put(
        f"/api/v1/entries/{entry.id}",
        json={"amount": 25.00, "type": "credit"},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["amount"] == 25.0
    assert data["type"] == "credit"


@pytest.mark.asyncio
async def test_update_entry_ownership(client: AsyncClient, db_session: AsyncSession):
    """User cannot update entries belonging to another user."""
    user1, budget1 = await _create_user_with_budget(db_session)
    user2, _ = await _create_user_with_budget(db_session)

    entry = Entry(
        user_id=user1.id,
        budget_id=budget1.id,
        amount=50.00,
        type="expense",
        date=date(2026, 3, 1),
    )
    db_session.add(entry)
    await db_session.commit()

    resp = await client.put(
        f"/api/v1/entries/{entry.id}",
        json={"amount": 1.00},
        cookies=_auth_cookie(user2.id),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_entry_negative_amount_rejected(client: AsyncClient, db_session: AsyncSession):
    """PUT /entries/{id} with negative amount must return 400/422."""
    user, budget = await _create_user_with_budget(db_session)
    entry = Entry(
        user_id=user.id,
        budget_id=budget.id,
        amount=10.00,
        type="expense",
        date=date(2026, 3, 1),
    )
    db_session.add(entry)
    await db_session.commit()

    resp = await client.put(
        f"/api/v1/entries/{entry.id}",
        json={"amount": -5.00},
        cookies=_auth_cookie(user.id),
    )
    assert resp.status_code in (400, 422)
