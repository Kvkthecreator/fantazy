"""FastAPI dependencies for the application."""
from __future__ import annotations
from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status


async def get_current_user_id(request: Request) -> UUID:
    """Get the current authenticated user's ID from request state.

    The auth middleware sets request.state.user_id after JWT verification.
    """
    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    # Handle string UUIDs from middleware
    if isinstance(user_id, str):
        try:
            return UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user ID format",
            )

    return user_id


async def get_optional_user_id(request: Request) -> UUID | None:
    """Get the current user's ID if authenticated, None otherwise."""
    user_id = getattr(request.state, "user_id", None)

    if not user_id:
        return None

    if isinstance(user_id, str):
        try:
            return UUID(user_id)
        except ValueError:
            return None

    return user_id
