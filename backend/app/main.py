import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from app.config import settings
from app.limiter import limiter
from app.routers import auth, budget, entries, reports

logger = logging.getLogger(__name__)

app = FastAPI(title="Ledger Sub 7 API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — exact origin, no wildcard (required with allow_credentials=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


class CSRFMiddleware(BaseHTTPMiddleware):
    _SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    # Logout CSRF is low-severity (attacker can only force a sign-out, not steal data).
    # Exempting it avoids a chicken-and-egg problem for sessions that predate the csrf_token cookie.
    # exchange is server-to-server (frontend SSR → backend); no browser session to protect
    _EXEMPT_PATHS = {"/api/v1/auth/logout", "/api/v1/auth/exchange"}

    async def dispatch(self, request: StarletteRequest, call_next):
        if request.method not in self._SAFE_METHODS and request.url.path not in self._EXEMPT_PATHS:
            csrf_cookie = request.cookies.get("csrf_token")
            csrf_header = request.headers.get("X-CSRF-Token")
            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                return JSONResponse(
                    status_code=403,
                    content={"error": {"code": "CSRF_ERROR", "message": "CSRF validation failed", "details": []}},
                )
        return await call_next(request)


app.add_middleware(CSRFMiddleware)

# Register routers
app.include_router(auth.router)
app.include_router(budget.router)
app.include_router(entries.router)
app.include_router(reports.router)


# Override 422 to match error format; also catch Starlette 404s
@app.exception_handler(RequestValidationError)
async def validation_handler(request, exc):
    errors = [
        {"field": ".".join(str(l) for l in e["loc"]), "reason": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Validation failed", "details": errors}},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": str(exc.detail), "details": []}},
    )


@app.exception_handler(Exception)
async def unhandled_handler(request, exc):
    logger.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred", "details": []}},
    )


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}
