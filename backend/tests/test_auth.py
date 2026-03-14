"""
Auth endpoint tests.
Google OAuth exchange is mocked since we can't call Google in tests.
"""
import pytest
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
    assert "access_token" not in resp.cookies or resp.cookies["access_token"] == ""


# --- /api/v1/auth/exchange ---

def _mock_google_success(mock_httpx, mock_verify):
    """Configure mocks for a successful Google OAuth exchange."""
    mock_client = AsyncMock()
    mock_httpx.return_value.__aenter__.return_value = mock_client
    mock_client.post.return_value = MagicMock(
        status_code=200,
        json=lambda: {"id_token": "fake_id_token", "access_token": "fake_access_token"},
    )
    mock_verify.return_value = {
        "sub": "google_sub_123",
        "email": "test@example.com",
        "name": "Test User",
    }


@pytest.mark.asyncio
async def test_exchange_success(client: AsyncClient):
    """Exchange returns a JWT token and csrf_token on a valid code."""
    with patch("app.routers.auth.httpx.AsyncClient") as mock_httpx, \
         patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
        _mock_google_success(mock_httpx, mock_verify)

        resp = await client.post(
            "/api/v1/auth/exchange",
            json={
                "code": "valid_code",
                "code_verifier": "test_verifier_abcdefghijklmnopqrstuvwxyz01234",
                "redirect_uri": "http://localhost:3000/auth/callback",
            },
        )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "token" in data
    assert "csrf_token" in data
    assert isinstance(data["token"], str) and len(data["token"]) > 0
    assert isinstance(data["csrf_token"], str) and len(data["csrf_token"]) > 0


@pytest.mark.asyncio
async def test_exchange_creates_user_on_first_login(client: AsyncClient):
    """Exchange upserts the user — a brand-new Google sub creates a new user."""
    with patch("app.routers.auth.httpx.AsyncClient") as mock_httpx, \
         patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
        mock_client = AsyncMock()
        mock_httpx.return_value.__aenter__.return_value = mock_client
        mock_client.post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"id_token": "fake", "access_token": "fake"},
        )
        mock_verify.return_value = {
            "sub": "new_user_sub_999",
            "email": "newuser@example.com",
            "name": "New User",
        }

        resp = await client.post(
            "/api/v1/auth/exchange",
            json={
                "code": "any_code",
                "code_verifier": "any_verifier_abcdefghijklmnopqrstuvwxyz0",
                "redirect_uri": "http://localhost:3000/auth/callback",
            },
        )

    assert resp.status_code == 200
    assert "token" in resp.json()["data"]


@pytest.mark.asyncio
async def test_exchange_invalid_code(client: AsyncClient):
    """Exchange returns 400 when Google rejects the authorization code."""
    with patch("app.routers.auth.httpx.AsyncClient") as mock_httpx:
        mock_client = AsyncMock()
        mock_httpx.return_value.__aenter__.return_value = mock_client
        mock_client.post.return_value = MagicMock(
            status_code=400,
            json=lambda: {"error": "invalid_grant"},
        )

        resp = await client.post(
            "/api/v1/auth/exchange",
            json={
                "code": "expired_or_invalid_code",
                "code_verifier": "test_verifier_abcdefghijklmnopqrstuvwxyz01234",
                "redirect_uri": "http://localhost:3000/auth/callback",
            },
        )

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_exchange_invalid_id_token(client: AsyncClient):
    """Exchange returns 400 when Google id_token fails verification."""
    with patch("app.routers.auth.httpx.AsyncClient") as mock_httpx, \
         patch("app.routers.auth.id_token.verify_oauth2_token") as mock_verify:
        mock_client = AsyncMock()
        mock_httpx.return_value.__aenter__.return_value = mock_client
        mock_client.post.return_value = MagicMock(
            status_code=200,
            json=lambda: {"id_token": "tampered_token", "access_token": "fake"},
        )
        mock_verify.side_effect = ValueError("Token verification failed")

        resp = await client.post(
            "/api/v1/auth/exchange",
            json={
                "code": "some_code",
                "code_verifier": "test_verifier_abcdefghijklmnopqrstuvwxyz01234",
                "redirect_uri": "http://localhost:3000/auth/callback",
            },
        )

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_exchange_missing_fields(client: AsyncClient):
    """Exchange returns 400 when required fields are absent."""
    resp = await client.post(
        "/api/v1/auth/exchange",
        json={"code": "only_code"},
    )
    assert resp.status_code == 400
