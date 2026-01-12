#!/usr/bin/env python3
"""
Episode 0 Health Check

Checks for common Episode 0 issues:
1. Series without Episode 0
2. Episode 0s without roles
3. Episode 0s without starter prompts

Run: python -m app.scripts.check_episode_health
"""

import asyncio
from app.database import get_db


async def check_episode_health():
    """Run Episode 0 health checks."""
    db = get_db()

    print("=== Episode 0 Health Check ===\n")

    # Check 1: Episode 0s without roles
    missing_roles = await db.fetch_all("""
        SELECT
            s.slug,
            et.title,
            et.id,
            et.episode_number
        FROM episode_templates et
        JOIN series s ON s.id = et.series_id
        WHERE et.episode_number = 0 AND et.role_id IS NULL
        ORDER BY s.slug
    """)

    if missing_roles:
        print(f"❌ {len(missing_roles)} Episode 0s WITHOUT roles:")
        for row in missing_roles:
            print(f"   - {row['slug']}: {row['title']} (id: {row['id']})")
    else:
        print("✓ All Episode 0s have roles assigned")

    print()

    # Check 2: Series without Episode 0
    missing_ep0 = await db.fetch_all("""
        SELECT s.slug, s.title, s.id
        FROM series s
        WHERE s.status = 'active'
        AND NOT EXISTS (
            SELECT 1 FROM episode_templates et
            WHERE et.series_id = s.id AND et.episode_number = 0
        )
        ORDER BY s.slug
    """)

    if missing_ep0:
        print(f"❌ {len(missing_ep0)} active series WITHOUT Episode 0:")
        for row in missing_ep0:
            print(f"   - {row['slug']}: {row['title']} (id: {row['id']})")
    else:
        print("✓ All active series have Episode 0")

    print()

    # Check 3: Episode 0s without starter prompts
    no_prompts = await db.fetch_all("""
        SELECT
            s.slug,
            et.title,
            et.id
        FROM episode_templates et
        JOIN series s ON s.id = et.series_id
        WHERE et.episode_number = 0
        AND (et.starter_prompts IS NULL OR array_length(et.starter_prompts, 1) = 0)
        ORDER BY s.slug
    """)

    if no_prompts:
        print(f"⚠️  {len(no_prompts)} Episode 0s WITHOUT starter prompts:")
        for row in no_prompts:
            print(f"   - {row['slug']}: {row['title']} (id: {row['id']})")
    else:
        print("✓ All Episode 0s have starter prompts")

    print()

    # Summary stats
    stats = await db.fetch_one("""
        SELECT
            COUNT(*) FILTER (WHERE episode_number = 0) as total_ep0s,
            COUNT(*) FILTER (WHERE episode_number = 0 AND role_id IS NOT NULL) as ep0_with_roles,
            COUNT(*) FILTER (WHERE episode_number = 0 AND starter_prompts IS NOT NULL
                            AND array_length(starter_prompts, 1) > 0) as ep0_with_prompts,
            COUNT(DISTINCT series_id) as series_count
        FROM episode_templates
    """)

    print("=== Summary ===")
    print(f"Total Episode 0s: {stats['total_ep0s']}")
    print(f"With roles: {stats['ep0_with_roles']} ({100 * stats['ep0_with_roles'] / max(stats['total_ep0s'], 1):.1f}%)")
    print(f"With prompts: {stats['ep0_with_prompts']} ({100 * stats['ep0_with_prompts'] / max(stats['total_ep0s'], 1):.1f}%)")
    print(f"Total series: {stats['series_count']}")


if __name__ == "__main__":
    asyncio.run(check_episode_health())
