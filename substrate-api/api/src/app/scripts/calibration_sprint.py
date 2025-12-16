"""Task 5: Studio Calibration Sprint

End-to-end validation of the full Studio pipeline:
- Character Core → Conversation Ignition → Hero Avatar → Expressions → Activation

This script:
1. Audits existing characters and fixes data inconsistencies
2. Creates 7 new characters covering different archetypes
3. Generates hero avatars and expressions
4. Applies calibration rubric

Usage:
    cd substrate-api/api
    python -m app.scripts.calibration_sprint --action audit
    python -m app.scripts.calibration_sprint --action create-new
    python -m app.scripts.calibration_sprint --action generate-assets
    python -m app.scripts.calibration_sprint --action full-run
"""

import argparse
import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import UUID

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
log = logging.getLogger(__name__)


# =============================================================================
# Character Templates (7 new characters to reach 10 total)
# =============================================================================

NEW_CHARACTER_TEMPLATES = [
    {
        "name": "Luna",
        "archetype": "comforting",
        "personality_preset": "warm_supportive",
        "content_rating": "sfw",
        "appearance_hint": "silver-white hair, gentle violet eyes, cozy oversized sweater, soft features",
    },
    {
        "name": "Raven",
        "archetype": "mysterious",
        "personality_preset": "mysterious_reserved",
        "content_rating": "sfw",
        "appearance_hint": "dark hair with purple streaks, sharp amber eyes, leather jacket, enigmatic smirk",
    },
    {
        "name": "Felix",
        "archetype": "playful",
        "personality_preset": "playful_teasing",
        "content_rating": "sfw",
        "appearance_hint": "messy auburn hair, bright green eyes, casual hoodie, mischievous grin",
    },
    {
        "name": "Morgan",
        "archetype": "mentor",
        "personality_preset": "warm_supportive",  # Mentor uses warm supportive base
        "content_rating": "sfw",
        "appearance_hint": "short grey-streaked hair, warm brown eyes, glasses, kind weathered face",
    },
    {
        "name": "Ash",
        "archetype": "brooding",
        "personality_preset": "mysterious_reserved",  # Brooding uses mysterious base
        "content_rating": "sfw",
        "appearance_hint": "black tousled hair, intense dark eyes, black turtleneck, contemplative expression",
    },
    {
        "name": "Jade",
        "archetype": "flirty",
        "personality_preset": "playful_teasing",  # Flirty uses playful base
        "content_rating": "sfw",
        "appearance_hint": "long wavy chestnut hair, sparkling hazel eyes, stylish dress, confident smile",
    },
    {
        "name": "River",
        "archetype": "chaotic",
        "personality_preset": "cheerful_energetic",  # Chaotic uses energetic base
        "content_rating": "sfw",
        "appearance_hint": "wild colorful hair, mismatched eyes, eclectic outfit with patches, excited expression",
    },
]


# =============================================================================
# Calibration Rubric
# =============================================================================

@dataclass
class RubricScore:
    """Calibration rubric for character evaluation."""
    character_name: str
    first_message_pull: int = 0  # 1-5: Does opening line invite reply?
    archetype_clarity: int = 0   # 1-5: Can you tell the vibe in <10 sec?
    visual_trust: int = 0        # 1-5: Avatar looks main-character, matches vibe?
    safety_pacing: int = 0       # 1-5: No premature escalation?
    coherence_3turn: int = 0     # 1-5: First 3 messages stay in character?
    notes: str = ""

    @property
    def average(self) -> float:
        scores = [
            self.first_message_pull,
            self.archetype_clarity,
            self.visual_trust,
            self.safety_pacing,
            self.coherence_3turn,
        ]
        return sum(scores) / len(scores) if all(s > 0 for s in scores) else 0.0

    @property
    def can_activate(self) -> bool:
        """Check if character meets activation threshold."""
        return (
            self.average >= 4.0
            and self.safety_pacing >= 4  # No safety violations
            and self.visual_trust >= 3   # No visual mismatch red flag
        )


@dataclass
class CalibrationResult:
    """Full calibration result for a character."""
    character_id: str
    name: str
    archetype: str
    status: str
    has_avatar_kit: bool = False
    has_hero_avatar: bool = False
    has_avatar_url: bool = False
    expression_count: int = 0
    opening_situation: Optional[str] = None
    opening_line: Optional[str] = None
    rubric: Optional[RubricScore] = None
    issues: List[str] = field(default_factory=list)
    fixes_applied: List[str] = field(default_factory=list)


# =============================================================================
# Database Operations
# =============================================================================

async def get_db_connection():
    """Get database connection."""
    import asyncpg

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable required")

    # Handle postgres:// vs postgresql://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    return await asyncpg.connect(database_url)


async def audit_existing_characters(conn) -> List[CalibrationResult]:
    """Audit all existing characters."""
    log.info("=== AUDITING EXISTING CHARACTERS ===")

    results = []

    # Get all characters with their avatar info and opening beat from episode_templates
    rows = await conn.fetch("""
        SELECT
            c.id,
            c.name,
            c.archetype,
            c.status,
            c.avatar_url,
            c.active_avatar_kit_id,
            et.situation as opening_situation,
            et.opening_line,
            c.content_rating,
            ak.primary_anchor_id,
            ak.appearance_prompt,
            aa.storage_path as anchor_path,
            (SELECT COUNT(*) FROM avatar_assets aa2
             WHERE aa2.avatar_kit_id = c.active_avatar_kit_id
             AND aa2.asset_type = 'expression'
             AND aa2.is_active) as expression_count
        FROM characters c
        LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        LEFT JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id
        LEFT JOIN episode_templates et ON et.character_id = c.id AND et.is_default = TRUE
        ORDER BY c.created_at
    """)

    for row in rows:
        result = CalibrationResult(
            character_id=str(row["id"]),
            name=row["name"],
            archetype=row["archetype"],
            status=row["status"],
            has_avatar_kit=row["active_avatar_kit_id"] is not None,
            has_hero_avatar=row["primary_anchor_id"] is not None,
            has_avatar_url=row["avatar_url"] is not None,
            expression_count=row["expression_count"] or 0,
            opening_situation=row["opening_situation"],
            opening_line=row["opening_line"],
        )

        # Check for issues
        if result.has_avatar_kit and result.has_hero_avatar and not result.has_avatar_url:
            result.issues.append("avatar_url not set despite having hero avatar")

        if result.status == "active" and not result.has_avatar_url:
            result.issues.append("character is active but has no avatar_url")

        if not result.opening_situation:
            result.issues.append("missing opening_situation")

        if not result.opening_line:
            result.issues.append("missing opening_line")

        if result.expression_count < 3 and result.has_hero_avatar:
            result.issues.append(f"only {result.expression_count}/3 minimum expressions")

        log.info(f"\n{row['name']} ({row['archetype']}):")
        log.info(f"  Status: {row['status']}")
        log.info(f"  Avatar Kit: {result.has_avatar_kit}")
        log.info(f"  Hero Avatar: {result.has_hero_avatar}")
        log.info(f"  Avatar URL: {result.has_avatar_url}")
        log.info(f"  Expressions: {result.expression_count}")
        log.info(f"  Issues: {result.issues if result.issues else 'None'}")

        results.append(result)

    return results


async def fix_avatar_urls(conn) -> List[str]:
    """Fix characters with hero avatars but no avatar_url."""
    from app.services.storage import StorageService

    log.info("\n=== FIXING AVATAR URLs ===")
    fixes = []

    # Get characters needing URL fix
    rows = await conn.fetch("""
        SELECT
            c.id,
            c.name,
            aa.storage_path
        FROM characters c
        JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
        JOIN avatar_assets aa ON aa.id = ak.primary_anchor_id
        WHERE c.avatar_url IS NULL
        AND aa.storage_path IS NOT NULL
    """)

    if not rows:
        log.info("No avatar URLs need fixing")
        return fixes

    storage = StorageService.get_instance()

    for row in rows:
        storage_path = row["storage_path"]

        # Generate signed URL
        try:
            signed_url = await storage.create_signed_url("avatars", storage_path)

            # Update character
            await conn.execute(
                "UPDATE characters SET avatar_url = $1, updated_at = NOW() WHERE id = $2",
                signed_url, row["id"]
            )

            fix_msg = f"Fixed avatar_url for {row['name']}"
            log.info(f"  ✓ {fix_msg}")
            fixes.append(fix_msg)

        except Exception as e:
            log.error(f"  ✗ Failed to fix {row['name']}: {e}")

    return fixes


async def create_new_character(
    conn,
    template: Dict[str, Any],
    user_id: str,
) -> Optional[str]:
    """Create a new character from template."""
    from app.services.conversation_ignition import generate_opening_beat
    from app.models.character import PERSONALITY_PRESETS, DEFAULT_BOUNDARIES

    log.info(f"\nCreating {template['name']} ({template['archetype']})...")

    # Get personality preset
    preset_name = template.get("personality_preset", "default")
    personality = PERSONALITY_PRESETS.get(preset_name, PERSONALITY_PRESETS.get("comforting_default", {}))

    # Generate slug
    slug = template["name"].lower().replace(" ", "-")

    # Check if character already exists
    existing = await conn.fetchrow(
        "SELECT id FROM characters WHERE slug = $1",
        slug
    )
    if existing:
        log.info(f"  Character {template['name']} already exists, skipping")
        return str(existing["id"])

    # Generate opening beat
    log.info(f"  Generating opening beat...")
    try:
        ignition_result = await generate_opening_beat(
            name=template["name"],
            archetype=template["archetype"],
            personality=personality,
            boundaries=DEFAULT_BOUNDARIES,
            content_rating=template.get("content_rating", "sfw"),
        )
    except Exception as e:
        log.error(f"  Failed to generate opening beat: {e}")
        # Use fallback
        ignition_result = type('obj', (object,), {
            'opening_situation': f"You encounter {template['name']}.",
            'opening_line': f"Hey there.",
            'starter_prompts': ["Hey there."],
            'is_valid': False,
        })()

    # Build system prompt (simplified)
    system_prompt = f"""You are {template['name']}, a {template['archetype']} character.

Personality traits: {json.dumps(personality.get('traits', []))}

Stay in character. Be {template['archetype']} in your responses.
"""

    # Insert character (opening beat goes to episode_templates - EP-01 Episode-First Pivot)
    row = await conn.fetchrow("""
        INSERT INTO characters (
            name, slug, archetype,
            baseline_personality, boundaries, content_rating,
            system_prompt, starter_prompts,
            status, is_active, created_by
        ) VALUES (
            $1, $2, $3,
            $4, $5, $6,
            $7, $8,
            'draft', FALSE, $9
        )
        RETURNING id
    """,
        template["name"],
        slug,
        template["archetype"],
        json.dumps(personality),
        json.dumps(DEFAULT_BOUNDARIES),
        template.get("content_rating", "sfw"),
        system_prompt,
        ignition_result.starter_prompts if hasattr(ignition_result, 'starter_prompts') else [ignition_result.opening_line],
        user_id,
    )

    character_id = str(row["id"])
    log.info(f"  ✓ Created character {character_id}")

    # Create Episode 0 template with opening beat (EP-01 Episode-First Pivot)
    await conn.execute("""
        INSERT INTO episode_templates (
            character_id, episode_number, title, slug,
            situation, opening_line,
            episode_type, is_default, sort_order, status
        ) VALUES ($1, 0, $2, $3, $4, $5, 'entry', TRUE, 0, 'draft')
    """,
        character_id,
        f"Episode 0: {template['name']}",
        f"episode-0-{slug}",
        ignition_result.opening_situation,
        ignition_result.opening_line,
    )
    log.info(f"  ✓ Created Episode 0 template")

    return character_id


async def generate_hero_avatar_for_character(
    conn,
    character_id: str,
    user_id: str,
    appearance_hint: Optional[str] = None,
) -> bool:
    """Generate hero avatar for a character."""
    from app.services.avatar_generation import get_avatar_generation_service

    service = get_avatar_generation_service()

    log.info(f"  Generating hero avatar...")

    result = await service.generate_hero_avatar(
        character_id=UUID(character_id),
        user_id=UUID(user_id),
        db=conn,
        appearance_description=appearance_hint,
    )

    if result.success:
        log.info(f"  ✓ Generated hero avatar: {result.asset_id}")
        return True
    else:
        log.error(f"  ✗ Failed: {result.error}")
        return False


async def generate_expressions_for_character(
    conn,
    character_id: str,
    user_id: str,
    expression_list: List[str] = None,
) -> int:
    """Generate expression pack for a character."""
    from app.services.avatar_generation import get_avatar_generation_service

    if expression_list is None:
        expression_list = ["smile", "shy", "thoughtful"]  # Minimum 3

    service = get_avatar_generation_service()
    generated = 0

    for expression in expression_list:
        log.info(f"  Generating {expression} expression...")

        result = await service.generate_expression(
            character_id=UUID(character_id),
            user_id=UUID(user_id),
            expression=expression,
            db=conn,
        )

        if result.success:
            log.info(f"  ✓ Generated {expression}")
            generated += 1
        else:
            log.error(f"  ✗ {expression} failed: {result.error}")

    return generated


# =============================================================================
# Main Calibration Functions
# =============================================================================

async def run_audit():
    """Run Part A: Audit existing characters."""
    conn = await get_db_connection()

    try:
        results = await audit_existing_characters(conn)
        fixes = await fix_avatar_urls(conn)

        log.info("\n=== AUDIT SUMMARY ===")
        log.info(f"Total characters: {len(results)}")
        log.info(f"Fixes applied: {len(fixes)}")

        for fix in fixes:
            log.info(f"  - {fix}")

        return results

    finally:
        await conn.close()


async def run_create_new(user_id: str):
    """Run Part B: Create 7 new characters."""
    conn = await get_db_connection()

    try:
        created_ids = []

        for template in NEW_CHARACTER_TEMPLATES:
            char_id = await create_new_character(conn, template, user_id)
            if char_id:
                created_ids.append((char_id, template))

        log.info(f"\n=== CREATION SUMMARY ===")
        log.info(f"Created/Found: {len(created_ids)} characters")

        return created_ids

    finally:
        await conn.close()


async def run_generate_assets(user_id: str):
    """Generate hero avatars and expressions for all characters."""
    conn = await get_db_connection()

    try:
        # Get all characters needing assets
        rows = await conn.fetch("""
            SELECT
                c.id,
                c.name,
                c.active_avatar_kit_id,
                ak.primary_anchor_id,
                (SELECT COUNT(*) FROM avatar_assets aa
                 WHERE aa.avatar_kit_id = c.active_avatar_kit_id
                 AND aa.asset_type = 'expression'
                 AND aa.is_active) as expression_count
            FROM characters c
            LEFT JOIN avatar_kits ak ON ak.id = c.active_avatar_kit_id
            WHERE c.created_by = $1
            ORDER BY c.created_at
        """, user_id)

        for row in rows:
            log.info(f"\n=== Processing {row['name']} ===")

            # Generate hero avatar if needed
            if row["primary_anchor_id"] is None:
                # Find appearance hint from template
                template = next(
                    (t for t in NEW_CHARACTER_TEMPLATES if t["name"] == row["name"]),
                    None
                )
                appearance_hint = template.get("appearance_hint") if template else None

                await generate_hero_avatar_for_character(
                    conn,
                    str(row["id"]),
                    user_id,
                    appearance_hint,
                )
            else:
                log.info(f"  Hero avatar already exists")

            # Generate expressions if needed (minimum 3)
            current_count = row["expression_count"] or 0
            if current_count < 3:
                needed = 3 - current_count
                expressions_to_gen = ["smile", "shy", "thoughtful"][:needed]

                await generate_expressions_for_character(
                    conn,
                    str(row["id"]),
                    user_id,
                    expressions_to_gen,
                )
            else:
                log.info(f"  Expression pack complete ({current_count})")

    finally:
        await conn.close()


async def run_full_calibration(user_id: str):
    """Run full calibration sprint."""
    log.info("=" * 60)
    log.info("TASK 5: STUDIO CALIBRATION SPRINT")
    log.info("=" * 60)

    # Part A: Audit existing
    log.info("\n" + "=" * 40)
    log.info("PART A: AUDIT EXISTING CHARACTERS")
    log.info("=" * 40)
    await run_audit()

    # Part B: Create new
    log.info("\n" + "=" * 40)
    log.info("PART B: CREATE NEW CHARACTERS")
    log.info("=" * 40)
    await run_create_new(user_id)

    # Generate assets
    log.info("\n" + "=" * 40)
    log.info("GENERATING ASSETS")
    log.info("=" * 40)
    await run_generate_assets(user_id)

    # Final audit
    log.info("\n" + "=" * 40)
    log.info("FINAL STATUS")
    log.info("=" * 40)
    await run_audit()


# =============================================================================
# CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Studio Calibration Sprint")
    parser.add_argument(
        "--action",
        choices=["audit", "create-new", "generate-assets", "full-run"],
        required=True,
        help="Action to perform",
    )
    parser.add_argument(
        "--user-id",
        default=None,
        help="User ID for creating characters (required for create/generate actions)",
    )

    args = parser.parse_args()

    if args.action in ["create-new", "generate-assets", "full-run"]:
        if not args.user_id:
            # Try to get from env or use a default test user
            args.user_id = os.getenv("CALIBRATION_USER_ID")
            if not args.user_id:
                print("Error: --user-id required for this action")
                print("Set CALIBRATION_USER_ID env var or pass --user-id")
                return 1

    if args.action == "audit":
        asyncio.run(run_audit())
    elif args.action == "create-new":
        asyncio.run(run_create_new(args.user_id))
    elif args.action == "generate-assets":
        asyncio.run(run_generate_assets(args.user_id))
    elif args.action == "full-run":
        asyncio.run(run_full_calibration(args.user_id))

    return 0


if __name__ == "__main__":
    exit(main())
