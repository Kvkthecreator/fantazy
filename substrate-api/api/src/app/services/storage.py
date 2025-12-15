"""Supabase Storage service for image uploads.

Handles uploading images to Supabase Storage buckets:
- avatars: Private bucket for avatar kit assets (anchors, expressions)
- scenes: Private bucket for generated scene cards

Storage path conventions:
- avatars: {kit_id}/anchors/{asset_id}.png, {kit_id}/expressions/{asset_id}.png
- scenes: {user_id}/{episode_id}/{image_id}.png

Usage:
    service = StorageService.get_instance()

    # Upload a scene image
    path = await service.upload_scene(image_data, user_id, episode_id, image_id)

    # Upload an avatar asset
    path = await service.upload_avatar_asset(image_data, kit_id, asset_id, "anchor_portrait")

    # Get signed URL for private content
    url = await service.create_signed_url("avatars", path)
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

    async def upload_episode_background(
        self,
        image_bytes: bytes,
        character_id: UUID,
        episode_number: int,
        content_type: str = "image/png",
    ) -> str:
        """Upload an episode background to the scenes bucket.

        Path format: episodes/{character_id}/{episode_number}.png

        Returns the storage path (not full URL).
        """
        # Convert UUID to string if needed
        char_id_str = str(character_id)
        storage_path = f"episodes/{char_id_str}/{episode_number}.png"
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

        DEPRECATED: Use upload_avatar_asset() for avatar kit assets.

        Path format: {character_id}/{filename}

        Returns the storage path.
        """
        storage_path = f"{character_id}/{filename}"
        bucket = "avatars"

        await self._upload(bucket, storage_path, image_bytes, content_type)
        return storage_path

    async def upload_avatar_asset(
        self,
        image_bytes: bytes,
        kit_id: UUID,
        asset_id: UUID,
        asset_type: str,
        content_type: str = "image/png",
    ) -> str:
        """Upload an avatar asset to the avatars bucket.

        Path format: {kit_id}/{asset_folder}/{asset_id}.png

        Asset folders by type:
        - anchor_portrait, anchor_fullbody -> anchors/
        - expression -> expressions/
        - pose -> poses/
        - outfit -> outfits/

        Args:
            image_bytes: Image data
            kit_id: Avatar kit UUID
            asset_id: Asset UUID
            asset_type: One of anchor_portrait, anchor_fullbody, expression, pose, outfit
            content_type: MIME type (default image/png)

        Returns:
            Storage path (not full URL)
        """
        # Map asset types to folder names
        folder_map = {
            "anchor_portrait": "anchors",
            "anchor_fullbody": "anchors",
            "expression": "expressions",
            "pose": "poses",
            "outfit": "outfits",
        }
        folder = folder_map.get(asset_type, "other")

        storage_path = f"{kit_id}/{folder}/{asset_id}.png"
        bucket = "avatars"

        await self._upload(bucket, storage_path, image_bytes, content_type)
        return storage_path

    async def download(
        self,
        bucket: str,
        path: str,
    ) -> bytes:
        """Download an object from storage.

        Returns the file contents as bytes.
        """
        url = f"{self.supabase_url}/storage/v1/object/{bucket}/{path}"

        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
        }

        response = await self.client.get(url, headers=headers)

        if response.status_code != 200:
            log.error(f"Storage download failed: {response.status_code} {response.text}")
            response.raise_for_status()

        return response.content

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

    async def create_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 3600,  # 1 hour default
    ) -> str:
        """Create a signed URL for temporary public access.

        Args:
            bucket: Storage bucket name
            path: Object path within bucket
            expires_in: Seconds until URL expires (default 1 hour)

        Returns:
            Signed URL string
        """
        url = f"{self.supabase_url}/storage/v1/object/sign/{bucket}/{path}"

        headers = {
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

        payload = {"expiresIn": expires_in}

        response = await self.client.post(url, headers=headers, json=payload)

        if response.status_code != 200:
            log.error(f"Failed to create signed URL: {response.status_code} {response.text}")
            # Fallback to authenticated URL
            return self.get_authenticated_url(bucket, path)

        data = response.json()
        signed_path = data.get("signedURL", "")

        # signedURL is relative, prepend base URL
        return f"{self.supabase_url}/storage/v1{signed_path}"

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
