import secrets
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


class ExchangeRequest(BaseModel):
    code: str
    code_verifier: str
    redirect_uri: str


class UserUpdate(BaseModel):
    week_start_day: int | None = None

    @field_validator("week_start_day")
    @classmethod
    def validate_week_start(cls, v):
        if v is not None and v not in range(7):
            raise ValueError("week_start_day must be 0-6")
        return v


def _issue_jwt(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


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
        existing = await db.execute(select(User).where(User.google_id == google_sub))
        user = existing.scalar_one()
    await db.commit()
    return user


@router.post("/exchange")
@limiter.limit("10/minute")
async def exchange_code(
    request: Request,
    body: ExchangeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Exchange a Google authorization code + PKCE verifier for a JWT.

    Called server-to-server by the frontend SSR after it receives the OAuth
    callback. The client_secret never leaves the backend. The frontend SSR
    sets the returned token and csrf_token as httpOnly cookies on its own domain.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": body.code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": body.redirect_uri,
            "grant_type": "authorization_code",
            "code_verifier": body.code_verifier,
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

    return {
        "data": {
            "token": _issue_jwt(user.id),
            "csrf_token": secrets.token_urlsafe(32),
        }
    }


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
