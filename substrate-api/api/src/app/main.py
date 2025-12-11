"""
Fantazy API - Cozy Companion Backend

FastAPI application for the Fantazy AI companion experience.
"""
import os
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.deps import get_db, close_db
from middleware.auth import AuthMiddleware

# Routes
from app.routes import health

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    log.info("Starting Fantazy API...")
    # Initialize database connection pool
    await get_db()
    log.info("Database connection established")
    yield
    # Cleanup
    log.info("Shutting down Fantazy API...")
    await close_db()
    log.info("Database connection closed")


app = FastAPI(
    title="Fantazy API",
    description="Cozy Companion Backend - AI characters that remember your story",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:3000")
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
    exempt_prefixes={"/health/"},
)

# Include routers
app.include_router(health.router, tags=["Health"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "Fantazy API",
        "version": "0.1.0",
        "description": "Cozy Companion Backend - AI characters that remember your story",
    }
