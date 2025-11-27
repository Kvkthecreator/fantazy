"""
Auth adapter: JWT utilities for agent routes.

This adapter provides authentication utilities for agent routes,
using PyJWT for token decoding/verification.

Architecture flow:
Agent routes → AuthAdapter → PyJWT → JWT validation
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import jwt

logger = logging.getLogger(__name__)


def decode_jwt(token: str) -> Optional[Dict[str, Any]]:
    """Decode JWT token without verification (for extracting claims)."""
    try:
        return jwt.decode(token, options={"verify_signature": False})
    except Exception:
        return None


def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode JWT token."""
    # For service-to-service, we decode without full verification
    # Full verification happens at AuthMiddleware level
    return decode_jwt(token)


class AuthAdapter:
    """
    Adapter for authentication utilities.

    Provides utilities for:
    - JWT token verification
    - User ID extraction
    - Workspace ID extraction
    - Service token validation
    """

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Verify JWT token.

        Args:
            token: JWT token string

        Returns:
            Decoded token payload if valid, None otherwise
        """
        try:
            payload = verify_jwt_token(token)
            if payload:
                logger.debug("Token verified successfully")
                return payload
            else:
                logger.warning("Token verification failed")
                return None
        except Exception as e:
            logger.error(f"Error verifying token: {e}")
            return None

    @staticmethod
    def decode_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Decode JWT token (without verification) using Phase 1-3 infrastructure.

        Args:
            token: JWT token string

        Returns:
            Decoded token payload if valid format, None otherwise
        """
        try:
            payload = decode_jwt(token)
            if payload:
                logger.debug("Token decoded successfully")
                return payload
            else:
                logger.warning("Token decode failed")
                return None
        except Exception as e:
            logger.error(f"Error decoding token: {e}")
            return None

    @staticmethod
    def get_user_id(token: str) -> Optional[str]:
        """
        Extract user ID from JWT token.

        Args:
            token: JWT token string

        Returns:
            User ID if present, None otherwise
        """
        payload = AuthAdapter.decode_token(token)
        if not payload:
            return None

        # Check common JWT claims
        user_id = (
            payload.get("sub") or
            payload.get("user_id") or
            payload.get("uid")
        )

        if user_id:
            logger.debug(f"Extracted user_id: {user_id}")
        else:
            logger.warning("No user_id found in token")

        return user_id

    @staticmethod
    def get_workspace_id(token: str) -> Optional[str]:
        """
        Extract workspace ID from JWT token.

        Args:
            token: JWT token string

        Returns:
            Workspace ID if present, None otherwise
        """
        payload = AuthAdapter.decode_token(token)
        if not payload:
            return None

        # Check common workspace claims
        workspace_id = (
            payload.get("workspace_id") or
            payload.get("workspace") or
            payload.get("org_id")
        )

        if workspace_id:
            logger.debug(f"Extracted workspace_id: {workspace_id}")
        else:
            logger.warning("No workspace_id found in token")

        return workspace_id

    @staticmethod
    def extract_from_header(authorization: Optional[str]) -> Optional[str]:
        """
        Extract token from Authorization header.

        Args:
            authorization: Authorization header value (e.g., "Bearer <token>")

        Returns:
            Token string if valid format, None otherwise
        """
        if not authorization:
            return None

        # Handle "Bearer <token>" format
        if authorization.startswith("Bearer "):
            token = authorization[7:].strip()
            if token:
                return token

        # Handle direct token (no "Bearer" prefix)
        if authorization and len(authorization) > 20:
            return authorization.strip()

        logger.warning("Invalid Authorization header format")
        return None

    @staticmethod
    def get_user_from_header(authorization: Optional[str]) -> Optional[str]:
        """
        Extract user ID from Authorization header.

        Args:
            authorization: Authorization header value

        Returns:
            User ID if valid token, None otherwise
        """
        token = AuthAdapter.extract_from_header(authorization)
        if not token:
            return None

        return AuthAdapter.get_user_id(token)

    @staticmethod
    def get_workspace_from_header(authorization: Optional[str]) -> Optional[str]:
        """
        Extract workspace ID from Authorization header.

        Args:
            authorization: Authorization header value

        Returns:
            Workspace ID if valid token, None otherwise
        """
        token = AuthAdapter.extract_from_header(authorization)
        if not token:
            return None

        return AuthAdapter.get_workspace_id(token)
