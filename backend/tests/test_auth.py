"""
Auth endpoint tests.
Google OAuth exchange is mocked since we can't call Google in tests.
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_me_unauthenticated(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_clears_cookie(client: AsyncClient):
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    # Cookie should be deleted
    assert "access_token" not in resp.cookies or resp.cookies["access_token"] == ""


@pytest.mark.asyncio
async def test_login_redirect_sets_state_cookie(client: AsyncClient):
    resp = await client.get("/api/v1/auth/login", follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert "location" in resp.headers
    location = resp.headers["location"]
    assert "accounts.google.com" in location
    assert "state=" in location
    assert "oauth_state" in resp.cookies


@pytest.mark.asyncio
async def test_callback_invalid_state(client: AsyncClient):
    """CSRF check: callback with wrong state must return 400."""
    resp = await client.get(
        "/api/v1/auth/callback?code=fake_code&state=wrong_state",
        cookies={"oauth_state": "correct_state"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_callback_missing_state_cookie(client: AsyncClient):
    resp = await client.get("/api/v1/auth/callback?code=fake_code&state=any_state")
    assert resp.status_code == 400
