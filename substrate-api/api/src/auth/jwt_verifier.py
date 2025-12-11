from __future__ import annotations
import os, base64, logging, jwt
from typing import Optional, Union
from fastapi import HTTPException

log = logging.getLogger("uvicorn.error")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
JWT_AUD = os.getenv("SUPABASE_JWT_AUD", "authenticated")
RAW_SECRET = os.getenv("SUPABASE_JWT_SECRET")


def _decode(token: str, secret: bytes | str):
    # Verify signature & aud; iss is checked manually to give better logs
    return jwt.decode(
        token,
        secret,
        algorithms=["HS256"],
        audience=JWT_AUD,
        options={"verify_exp": True},
    )


def verify_jwt(token: str) -> dict:
    if not RAW_SECRET:
        log.error("AUTH: SUPABASE_JWT_SECRET is empty")
        raise HTTPException(500, "auth_misconfigured")

    expected_iss = f"{SUPABASE_URL}/auth/v1" if SUPABASE_URL else None
    errors = []

    # 1) Raw secret (most common for Supabase)
    try:
        claims = _decode(token, RAW_SECRET)
        _post_checks(claims, expected_iss)
        log.info("AUTH: verified with RAW secret")
        return claims
    except Exception as e:
        errors.append(f"raw:{type(e).__name__}:{e}")

    # 2) Base64-decoded fallback
    try:
        claims = _decode(token, base64.b64decode(RAW_SECRET))
        _post_checks(claims, expected_iss)
        log.info("AUTH: verified with BASE64-decoded secret")
        return claims
    except Exception as e:
        errors.append(f"b64:{type(e).__name__}:{e}")

    log.error("AUTH: JWT verification failed (%s)", " ; ".join(errors))
    raise HTTPException(401, "Invalid authentication token")


def _post_checks(claims: dict, expected_iss: str | None):
    iss = claims.get("iss")
    aud = claims.get("aud")
    sub = claims.get("sub")
    if expected_iss and iss != expected_iss:
        log.warning("AUTH: iss mismatch token=%s expected=%s", iss, expected_iss)
    if aud != JWT_AUD:
        # PyJWT already verifies aud; this log is just clarity
        log.warning("AUTH: aud mismatch token=%s expected=%s", aud, JWT_AUD)
    if not sub:
        raise HTTPException(401, "Token missing subject")


__all__ = ["verify_jwt"]

