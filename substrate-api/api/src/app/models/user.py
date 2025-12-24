"""User models."""
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class UserPreferences(BaseModel):
    """User preferences stored as JSON."""

    notification_enabled: bool = True
    notification_time: Optional[str] = None
    theme: str = "system"
    language: str = "en"
    vibe_preference: Optional[str] = None
    visual_mode_override: Optional[str] = None  # "always_off" | "always_on" | "episode_default" | None


class UserCreate(BaseModel):
    """Data for creating a user profile."""

    display_name: Optional[str] = None
    pronouns: Optional[str] = None
    timezone: str = "UTC"


class UserUpdate(BaseModel):
    """Data for updating a user profile."""

    display_name: Optional[str] = None
    pronouns: Optional[str] = None
    timezone: Optional[str] = None
    preferences: Optional[UserPreferences] = None
    onboarding_completed: Optional[bool] = None
    onboarding_step: Optional[str] = None


class OnboardingData(BaseModel):
    """Data collected during onboarding."""

    display_name: str
    pronouns: Optional[str] = None
    timezone: str = "UTC"
    vibe_preference: str = Field(..., description="comforting, flirty, or chill")
    first_character_id: UUID
    age_confirmed: bool = True


class User(BaseModel):
    """User profile model."""

    id: UUID
    display_name: Optional[str] = None
    pronouns: Optional[str] = None
    timezone: str = "UTC"
    age_confirmed: bool = False
    onboarding_completed: bool = False
    onboarding_step: Optional[str] = None
    preferences: Dict[str, Any] = Field(default_factory=dict)
    subscription_status: str = "free"
    subscription_expires_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("preferences", mode="before")
    @classmethod
    def ensure_preferences_is_dict(cls, v: Any) -> Dict[str, Any]:
        """Handle corrupted preferences data (e.g., array instead of dict)."""
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        if isinstance(v, list):
            # Corrupted data - merge list items into dict
            result: Dict[str, Any] = {}
            for item in v:
                if isinstance(item, dict):
                    result.update(item)
                elif isinstance(item, str):
                    # Try to parse JSON string
                    import json
                    try:
                        parsed = json.loads(item)
                        if isinstance(parsed, dict):
                            result.update(parsed)
                    except (json.JSONDecodeError, TypeError):
                        pass
            return result
        return {}

    class Config:
        from_attributes = True
