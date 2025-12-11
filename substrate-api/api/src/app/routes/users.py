"""Users API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import get_db
from app.dependencies import get_current_user_id
from app.models.user import User, UserUpdate, OnboardingData

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
    import json

    preferences_update = json.dumps({"vibe_preference": data.vibe_preference})

    # Update user profile
    query = """
        UPDATE users
        SET
            display_name = :display_name,
            pronouns = :pronouns,
            timezone = :timezone,
            age_confirmed = :age_confirmed,
            onboarding_completed = TRUE,
            preferences = preferences || :preferences::jsonb,
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
            "preferences": preferences_update,
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
