"""Users API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.user import User, UserUpdate, OnboardingData
from app.models.usage import UsageResponse, FluxUsage, MessageUsage
from app.services.usage import UsageService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=User)
async def get_current_user(
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Get current user's profile."""
    query = """
        SELECT * FROM users WHERE id = :user_id
    """
    row = await db.fetch_one(query, {"user_id": str(user_id)})

    if not row:
        # Auto-create user profile if missing (fallback for auth trigger issues)
        create_query = """
            INSERT INTO users (id, display_name)
            VALUES (:user_id, 'User')
            ON CONFLICT (id) DO NOTHING
            RETURNING *
        """
        row = await db.fetch_one(create_query, {"user_id": str(user_id)})

        if not row:
            # If still no row, fetch again (might have been created by concurrent request)
            row = await db.fetch_one(query, {"user_id": str(user_id)})

        if not row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )

    return User(**dict(row))


@router.patch("/me", response_model=User)
async def update_current_user(
    data: UserUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Update current user's profile."""
    # Build dynamic update query
    updates = []
    values = {"user_id": str(user_id)}

    if data.display_name is not None:
        updates.append("display_name = :display_name")
        values["display_name"] = data.display_name

    if data.pronouns is not None:
        updates.append("pronouns = :pronouns")
        values["pronouns"] = data.pronouns

    if data.timezone is not None:
        updates.append("timezone = :timezone")
        values["timezone"] = data.timezone

    if data.preferences is not None:
        updates.append("preferences = :preferences")
        values["preferences"] = data.preferences.model_dump_json()

    if data.onboarding_completed is not None:
        updates.append("onboarding_completed = :onboarding_completed")
        values["onboarding_completed"] = data.onboarding_completed

    if data.onboarding_step is not None:
        updates.append("onboarding_step = :onboarding_step")
        values["onboarding_step"] = data.onboarding_step

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    query = f"""
        UPDATE users
        SET {", ".join(updates)}, updated_at = NOW()
        WHERE id = :user_id
        RETURNING *
    """

    row = await db.fetch_one(query, values)
    return User(**dict(row))


@router.post("/onboarding", response_model=User)
async def complete_onboarding(
    data: OnboardingData,
    user_id: UUID = Depends(get_current_user_id),
    db=Depends(get_db),
):
    """Complete user onboarding and create first relationship."""
    # Update user profile
    # Use COALESCE to ensure preferences is always a valid JSONB object before merging
    # and jsonb_build_object to construct the update object
    query = """
        UPDATE users
        SET
            display_name = :display_name,
            pronouns = :pronouns,
            timezone = :timezone,
            age_confirmed = :age_confirmed,
            onboarding_completed = TRUE,
            preferences = COALESCE(preferences, '{}'::jsonb) || jsonb_build_object('vibe_preference', :vibe_preference),
            updated_at = NOW()
        WHERE id = :user_id
        RETURNING *
    """

    row = await db.fetch_one(
        query,
        {
            "display_name": data.display_name,
            "pronouns": data.pronouns,
            "timezone": data.timezone,
            "age_confirmed": data.age_confirmed,
            "vibe_preference": data.vibe_preference,
            "user_id": str(user_id),
        },
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Create relationship with first character
    rel_query = """
        INSERT INTO relationships (user_id, character_id)
        VALUES (:user_id, :character_id)
        ON CONFLICT (user_id, character_id) DO NOTHING
        RETURNING id
    """
    await db.fetch_one(rel_query, {"user_id": str(user_id), "character_id": str(data.first_character_id)})

    return User(**dict(row))


@router.get("/me/usage", response_model=UsageResponse)
async def get_my_usage(
    user_id: UUID = Depends(get_current_user_id),
):
    """Get current user's usage statistics."""
    usage_service = UsageService.get_instance()

    try:
        stats = await usage_service.get_usage_stats(str(user_id))
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return UsageResponse(
        flux=FluxUsage(
            used=stats.flux_used,
            quota=stats.flux_quota,
            remaining=stats.flux_remaining,
            resets_at=stats.flux_resets_at,
        ),
        messages=MessageUsage(
            sent=stats.messages_sent,
            resets_at=stats.messages_resets_at,
        ),
        subscription_status=stats.subscription_status,
    )
