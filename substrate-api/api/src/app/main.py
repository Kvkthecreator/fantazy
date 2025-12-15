"""
Fantazy API - Cozy Companion Backend

FastAPI application for the Fantazy AI companion experience.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.deps import close_db, get_db
from middleware.auth import AuthMiddleware

# Routes
from app.routes import (
    avatars,
    characters,
    conversation,
    credits,
    episodes,
    health,
    hooks,
    memory,
    messages,
    relationships,
    scenes,
    studio,
    subscription,
    users,
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

# CORS configuration
# Default includes localhost and common Vercel patterns
default_origins = "http://localhost:3000,https://fantazy-five.vercel.app,https://*.vercel.app"
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

# Auth middleware with exemptions
app.add_middleware(
    AuthMiddleware,
    exempt_paths={"/", "/health", "/docs", "/openapi.json", "/redoc"},
    exempt_prefixes={"/health/", "/characters", "/webhooks"},  # Webhooks have their own auth
)

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(users.router, tags=["Users"])
app.include_router(characters.router, tags=["Characters"])
app.include_router(relationships.router, tags=["Relationships"])
app.include_router(episodes.router, tags=["Episodes"])
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


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Fantazy API",
        "version": "0.1.0",
        "description": "Cozy Companion Backend - AI characters that remember your story",
        "docs": "/docs",
    }
