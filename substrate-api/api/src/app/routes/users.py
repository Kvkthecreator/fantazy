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
        SELECT * FROM users WHERE id = $1
    """
    row = await db.fetch_one(query, [user_id])

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
    values = []
    param_idx = 1

    if data.display_name is not None:
        updates.append(f"display_name = ${param_idx}")
        values.append(data.display_name)
        param_idx += 1

    if data.pronouns is not None:
        updates.append(f"pronouns = ${param_idx}")
        values.append(data.pronouns)
        param_idx += 1

    if data.timezone is not None:
        updates.append(f"timezone = ${param_idx}")
        values.append(data.timezone)
        param_idx += 1

    if data.preferences is not None:
        updates.append(f"preferences = ${param_idx}")
        values.append(data.preferences.model_dump_json())
        param_idx += 1

    if data.onboarding_completed is not None:
        updates.append(f"onboarding_completed = ${param_idx}")
        values.append(data.onboarding_completed)
        param_idx += 1

    if data.onboarding_step is not None:
        updates.append(f"onboarding_step = ${param_idx}")
        values.append(data.onboarding_step)
        param_idx += 1

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update",
        )

    values.append(user_id)
    query = f"""
        UPDATE users
        SET {", ".join(updates)}, updated_at = NOW()
        WHERE id = ${param_idx}
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
    query = """
        UPDATE users
        SET
            display_name = $1,
            pronouns = $2,
            timezone = $3,
            age_confirmed = $4,
            onboarding_completed = TRUE,
            preferences = preferences || $5::jsonb,
            updated_at = NOW()
        WHERE id = $6
        RETURNING *
    """

    import json

    preferences_update = json.dumps({"vibe_preference": data.vibe_preference})

    row = await db.fetch_one(
        query,
        [
            data.display_name,
            data.pronouns,
            data.timezone,
            data.age_confirmed,
            preferences_update,
            user_id,
        ],
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Create relationship with first character
    rel_query = """
        INSERT INTO relationships (user_id, character_id)
        VALUES ($1, $2)
        ON CONFLICT (user_id, character_id) DO NOTHING
        RETURNING id
    """
    await db.fetch_one(rel_query, [user_id, data.first_character_id])

    return User(**dict(row))
