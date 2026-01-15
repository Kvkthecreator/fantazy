"""
Fantazy API - Cozy Companion Backend

FastAPI application for the Fantazy AI companion experience.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.deps import close_db, get_db
from middleware.auth import AuthMiddleware
from middleware.security_headers import SecurityHeadersMiddleware

# Routes
from app.routes import (
    admin,
    avatars,
    characters,
    conversation,
    credits,
    engagements,
    sessions,
    episode_templates,
    roles,
    series,
    worlds,
    health,
    hooks,
    memory,
    messages,
    scenes,
    studio,
    subscription,
    users,
    games,
    webhooks,
)

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    log.info("Starting Fantazy API...")

    # Initialize database connection pool
    await get_db()
    log.info("Database connection established")

    # Initialize LLM service and log configuration
    from app.services.llm import LLMService
    llm = LLMService.get_instance()
    log.info(f"LLM configured: {llm.provider.value} / {llm.model}")

    yield

    # Cleanup
    log.info("Shutting down Fantazy API...")
    await close_db()

    # Close LLM client
    from app.services.llm import LLMService

    if LLMService._instance:
        await LLMService._instance.close()

    # Close Image client
    from app.services.image import ImageService

    if ImageService._instance:
        await ImageService._instance.close()

    # Close Storage client
    from app.services.storage import StorageService

    if StorageService._instance:
        await StorageService._instance.close()

    log.info("Shutdown complete")


app = FastAPI(
    title="Fantazy API",
    description="Cozy Companion Backend - AI characters that remember your story",
    version="0.1.0",
    lifespan=lifespan,
)


# =============================================================================
# Global Exception Handler with CORS
# =============================================================================
# When unhandled exceptions occur, FastAPI converts them to 500 responses
# BEFORE CORSMiddleware can add headers. This handler ensures CORS headers
# are present on error responses so browsers can read the error details.

def _add_cors_headers_to_response(response: JSONResponse, origin: str | None) -> JSONResponse:
    """Add CORS headers to error responses."""
    if not origin:
        return response

    # Check against allowed origins (mirrors CORS config above)
    import fnmatch
    cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://ep-0.com,https://www.ep-0.com,https://*.vercel.app")
    allowed_origins = [o.strip() for o in cors_origins_env.split(",")]

    origin_allowed = False
    for allowed in allowed_origins:
        if allowed == origin:
            origin_allowed = True
            break
        if "*" in allowed and fnmatch.fnmatch(origin, allowed.replace("*", "*")):
            origin_allowed = True
            break

    if origin_allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle unhandled exceptions with CORS headers."""
    log.error(f"Unhandled exception on {request.url.path}: {exc}", exc_info=True)

    response = JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "detail": str(exc)},
    )

    origin = request.headers.get("origin")
    return _add_cors_headers_to_response(response, origin)


# CORS configuration
# Default includes localhost and common Vercel patterns
default_origins = "http://localhost:3000,https://ep-0.com,https://www.ep-0.com,https://*.vercel.app"
cors_origins_env = os.getenv("CORS_ORIGINS", default_origins)
cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]
log.info(f"CORS allowed origins: {cors_origins}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers middleware (clickjacking protection, etc.)
app.add_middleware(SecurityHeadersMiddleware)

# Auth middleware with exemptions
app.add_middleware(
    AuthMiddleware,
    exempt_paths={"/", "/health", "/docs", "/openapi.json", "/redoc", "/sessions/guest"},
    exempt_prefixes={"/health/", "/characters", "/webhooks", "/studio/admin", "/episode-templates", "/series", "/worlds", "/roles", "/games/r", "/games/quiz", "/conversation", "/episodes"},
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(users.router, tags=["Users"])
app.include_router(characters.router, tags=["Characters"])
app.include_router(engagements.router, tags=["Engagements"])
app.include_router(sessions.router, tags=["Sessions"])
app.include_router(episode_templates.router, tags=["Episode Templates"])
app.include_router(series.router, tags=["Series"])
app.include_router(roles.router, tags=["Roles"])
app.include_router(worlds.router, tags=["Worlds"])
app.include_router(messages.router, tags=["Messages"])
app.include_router(memory.router, tags=["Memory"])
app.include_router(hooks.router, tags=["Hooks"])
app.include_router(conversation.router, tags=["Conversation"])
app.include_router(scenes.router, tags=["Scenes"])
app.include_router(avatars.router, tags=["Avatar Kits"])
app.include_router(subscription.router, tags=["Subscription"])
app.include_router(subscription.webhook_router, tags=["Webhooks"])
app.include_router(credits.router, tags=["Credits"])
app.include_router(credits.topup_router, tags=["Top-Up"])
app.include_router(studio.router, tags=["Studio"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(games.router, tags=["Games"])
app.include_router(webhooks.router, tags=["Webhooks"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Fantazy API",
        "version": "0.1.0",
        "description": "Cozy Companion Backend - AI characters that remember your story",
        "docs": "/docs",
    }
