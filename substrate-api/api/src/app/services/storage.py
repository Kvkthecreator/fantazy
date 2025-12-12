"""Supabase Storage service for image uploads.

Handles uploading images to Supabase Storage buckets:
- avatars: Public bucket for character avatars
- scenes: Authenticated bucket for generated scene cards

Usage:
    service = StorageService.get_instance()
    url = await service.upload_scene(
        image_bytes=image_data,
        user_id=user_id,
        episode_id=episode_id,
        image_id=image_id
    )
"""

import logging
import os
from typing import Optional
from uuid import UUID

import httpx

log = logging.getLogger(__name__)


class StorageService:
    """Supabase Storage service for image uploads."""

    _instance: Optional["StorageService"] = None

    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

        if not self.supabase_url or not self.service_role_key:
            log.warning("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")

        self.client = httpx.AsyncClient(timeout=60.0)

    @classmethod
    def get_instance(cls) -> "StorageService":
        """Get singleton instance."""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def upload_scene(
        self,
        image_bytes: bytes,
        user_id: UUID,
        episode_id: UUID,
        image_id: UUID,
        content_type: str = "image/png",
    ) -> str:
        """Upload a scene image to the scenes bucket.

        Path format: {user_id}/{episode_id}/{image_id}.png

        Returns the storage path (not full URL).
        """
        storage_path = f"{user_id}/{episode_id}/{image_id}.png"
        bucket = "scenes"

        await self._upload(bucket, storage_path, image_bytes, content_type)
        return storage_path

    async def upload_avatar(
        self,
        image_bytes: bytes,
        character_id: UUID,
        filename: str = "default.png",
        content_type: str = "image/png",
    ) -> str:
        """Upload a character avatar to the avatars bucket.

        Path format: {character_id}/{filename}

        Returns the storage path.
        """
        storage_path = f"{character_id}/{filename}"
        bucket = "avatars"

        await self._upload(bucket, storage_path, image_bytes, content_type)
        return storage_path

    async def _upload(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str,
    ) -> None:
        """Upload data to Supabase Storage."""
        url = f"{self.supabase_url}/storage/v1/object/{bucket}/{path}"

        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": content_type,
            "x-upsert": "true",  # Overwrite if exists
        }

        response = await self.client.post(url, headers=headers, content=data)

        if response.status_code not in (200, 201):
            log.error(f"Storage upload failed: {response.status_code} {response.text}")
            response.raise_for_status()

        log.info(f"Uploaded to {bucket}/{path}")

    def get_public_url(self, bucket: str, path: str) -> str:
        """Get public URL for an object (avatars bucket)."""
        return f"{self.supabase_url}/storage/v1/object/public/{bucket}/{path}"

    def get_authenticated_url(self, bucket: str, path: str) -> str:
        """Get authenticated URL for an object (scenes bucket).

        Note: Client must include JWT in request headers.
        """
        return f"{self.supabase_url}/storage/v1/object/authenticated/{bucket}/{path}"

    async def delete(self, bucket: str, path: str) -> None:
        """Delete an object from storage."""
        url = f"{self.supabase_url}/storage/v1/object/{bucket}/{path}"

        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
        }

        response = await self.client.delete(url, headers=headers)

        if response.status_code not in (200, 204):
            log.warning(f"Storage delete failed: {response.status_code}")

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
