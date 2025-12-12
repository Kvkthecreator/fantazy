#!/usr/bin/env python3
"""Test script to create an avatar kit and upload an anchor image.

Usage:
    python scripts/test_avatar_kit.py <image_path> [--character-id <uuid>]

This script:
1. Creates an avatar kit for the specified character
2. Uploads the image as an anchor_portrait asset
3. Sets it as the primary anchor
4. Activates the kit
5. Links it to the character
"""

import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path

# Add the API source to path
sys.path.insert(0, str(Path(__file__).parent.parent / "substrate-api" / "api" / "src"))

import asyncpg
from dotenv import load_dotenv

# Load environment variables
load_dotenv(Path(__file__).parent.parent / "substrate-api" / "api" / ".env")


async def main():
    parser = argparse.ArgumentParser(description="Create test avatar kit with anchor image")
    parser.add_argument("image_path", help="Path to the anchor image")
    parser.add_argument("--character-id", help="Character UUID (default: Mira)")
    parser.add_argument("--character-name", default="Mira", help="Character name for the kit")
    parser.add_argument("--kit-name", default="Default", help="Kit name suffix")
    args = parser.parse_args()

    # Verify image exists
    image_path = Path(args.image_path)
    if not image_path.exists():
        print(f"Error: Image not found at {image_path}")
        sys.exit(1)

    # Read image
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    print(f"Loaded image: {len(image_bytes)} bytes")

    # Connect to database
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        # Fallback to direct construction
        database_url = "postgresql://postgres.lfwhdzwbikyzalpbwfnd:42PJb25YJhJHJdkl@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"

    conn = await asyncpg.connect(database_url)
    print("Connected to database")

    try:
        # Get character
        if args.character_id:
            character = await conn.fetchrow(
                "SELECT id, name FROM characters WHERE id = $1",
                uuid.UUID(args.character_id)
            )
        else:
            character = await conn.fetchrow(
                "SELECT id, name FROM characters WHERE name = $1",
                args.character_name
            )

        if not character:
            print(f"Error: Character not found")
            # List available characters
            chars = await conn.fetch("SELECT id, name FROM characters")
            print("\nAvailable characters:")
            for c in chars:
                print(f"  {c['id']} - {c['name']}")
            sys.exit(1)

        character_id = character["id"]
        character_name = character["name"]
        print(f"Using character: {character_name} ({character_id})")

        # Create avatar kit
        kit_id = uuid.uuid4()
        kit_name = f"{character_name} {args.kit_name}"

        # Appearance prompt based on the image
        appearance_prompt = """Young woman with long black hair, side-swept bangs,
blue eyes with a hint of red, fair skin, soft features.
Wearing a white button-up shirt with a red bow tie ribbon,
dark pleated skirt. School uniform style."""

        style_prompt = """High-quality anime illustration style, semi-realistic rendering,
soft lighting with natural window light, detailed hair with shine highlights,
slight blush on cheeks, warm color palette, professional digital art quality."""

        negative_prompt = """Low quality, blurry, deformed, extra limbs,
bad anatomy, wrong proportions, multiple people, text, watermark."""

        await conn.execute("""
            INSERT INTO avatar_kits (
                id, character_id, name, description,
                appearance_prompt, style_prompt, negative_prompt,
                status, is_default
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', true)
        """, kit_id, character_id, kit_name,
            "Auto-generated from test script",
            appearance_prompt.strip(), style_prompt.strip(), negative_prompt.strip())

        print(f"Created avatar kit: {kit_name} ({kit_id})")

        # Upload to Supabase Storage
        from app.services.storage import StorageService
        storage = StorageService.get_instance()

        asset_id = uuid.uuid4()
        storage_path = await storage.upload_avatar_asset(
            image_bytes=image_bytes,
            kit_id=kit_id,
            asset_id=asset_id,
            asset_type="anchor_portrait",
        )
        print(f"Uploaded to storage: {storage_path}")

        # Create avatar asset record
        await conn.execute("""
            INSERT INTO avatar_assets (
                id, avatar_kit_id, asset_type,
                storage_bucket, storage_path, source_type,
                is_canonical, mime_type, file_size_bytes
            ) VALUES ($1, $2, 'anchor_portrait', 'avatars', $3, 'manual_upload', true, 'image/png', $4)
        """, asset_id, kit_id, storage_path, len(image_bytes))

        print(f"Created avatar asset: {asset_id}")

        # Set as primary anchor
        await conn.execute("""
            UPDATE avatar_kits
            SET primary_anchor_id = $1, updated_at = NOW()
            WHERE id = $2
        """, asset_id, kit_id)
        print(f"Set as primary anchor")

        # Activate the kit
        await conn.execute("""
            UPDATE avatar_kits
            SET status = 'active', updated_at = NOW()
            WHERE id = $1
        """, kit_id)
        print(f"Kit status: active")

        # Link to character
        await conn.execute("""
            UPDATE characters
            SET active_avatar_kit_id = $1
            WHERE id = $2
        """, kit_id, character_id)
        print(f"Linked kit to character")

        # Generate signed URL to verify
        signed_url = await storage.create_signed_url("avatars", storage_path)

        print("\n" + "="*60)
        print("SUCCESS!")
        print("="*60)
        print(f"Character: {character_name} ({character_id})")
        print(f"Avatar Kit: {kit_name} ({kit_id})")
        print(f"Anchor Asset: {asset_id}")
        print(f"Storage Path: avatars/{storage_path}")
        print(f"\nSigned URL (valid 1 hour):")
        print(signed_url)
        print("="*60)

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
