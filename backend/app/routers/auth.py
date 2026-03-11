import secrets
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
import jwt
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.limiter import limiter
from app.models import Budget, User

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class UserUpdate(BaseModel):
    week_start_day: int | None = None

    @field_validator("week_start_day")
    @classmethod
    def validate_week_start(cls, v):
        if v is not None and v not in range(7):
            raise ValueError("week_start_day must be 0-6")
        return v

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def _issue_jwt(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def _set_auth_cookie(response: Response, token: str) -> None:
    is_prod = settings.ENVIRONMENT == "production"
    max_age = settings.JWT_EXPIRE_DAYS * 24 * 60 * 60
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="lax",  # lax required: strict blocks the cookie on the post-OAuth redirect from Google
        max_age=max_age,
    )
    response.set_cookie(
        key="csrf_token",
        value=secrets.token_urlsafe(32),
        httponly=False,  # must be JS-readable for the Double Submit Cookie pattern
        secure=is_prod,
        samesite="strict",
        max_age=max_age,
    )


async def _upsert_user_and_budget(
    db: AsyncSession,
    google_sub: str,
    email: str,
    name: str,
) -> User:
    """Upsert User + Budget atomically using SAVEPOINT pattern."""
    try:
        async with db.begin_nested():  # SAVEPOINT
            user = User(google_id=google_sub, email=email, name=name)
            db.add(user)
            await db.flush()
            budget = Budget(user_id=user.id)
            db.add(budget)
            await db.flush()
    except IntegrityError as e:
        await db.rollback()
        orig = str(e.orig)
        if "uq_users_google_id" not in orig and "uq_users_email" not in orig:
            raise
        # Either unique constraint may fire first depending on Postgres index order;
        # always look up by google_id as the canonical OAuth identifier.
        existing = await db.execute(select(User).where(User.google_id == google_sub))
        user = existing.scalar_one()
    await db.commit()
    return user


@router.get("/login")
@limiter.limit("10/minute")
async def login_redirect(request: Request, response: Response):
    """Initiate Google OAuth flow with state parameter CSRF protection."""
    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "online",
    }
    google_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    redirect = RedirectResponse(google_url)
    redirect.set_cookie(
        "oauth_state", state,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",  # must be lax: Google's redirect back is a cross-site navigation
        max_age=600,
    )
    return redirect


@router.get("/callback")
@limiter.limit("10/minute")
async def google_callback(
    request: Request,
    code: str,
    state: str,
    oauth_state: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Handle Google OAuth callback: validate state, exchange code, upsert user, issue JWT."""
    if not oauth_state or oauth_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state parameter")

    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code")
        token_data = token_resp.json()

    raw_id_token = token_data.get("id_token")
    if not raw_id_token:
        raise HTTPException(status_code=400, detail="No ID token in response")

    try:
        idinfo = id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID token")

    google_sub = idinfo["sub"]
    email = idinfo.get("email", "")
    name = idinfo.get("name", email)

    user = await _upsert_user_and_budget(db, google_sub, email, name)

    jwt_token = _issue_jwt(user.id)
    redirect = RedirectResponse(settings.FRONTEND_URL + "/", status_code=302)
    _set_auth_cookie(redirect, jwt_token)
    redirect.delete_cookie("oauth_state")
    return redirect


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "data": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "week_start_day": current_user.week_start_day,
        }
    }


@router.patch("/me")
async def patch_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.week_start_day is not None:
        current_user.week_start_day = body.week_start_day
        db.add(current_user)
        await db.commit()
    return {
        "data": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "week_start_day": current_user.week_start_day,
        }
    }


@router.post("/logout")
async def logout(response: Response):
    is_prod = settings.ENVIRONMENT == "production"
    response.delete_cookie("access_token", httponly=True, secure=is_prod, samesite="lax")
    response.delete_cookie("csrf_token", httponly=False, secure=is_prod, samesite="strict")
    return {"data": {"ok": True}}
