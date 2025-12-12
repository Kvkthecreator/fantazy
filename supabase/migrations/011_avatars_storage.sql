-- Migration: 011_avatars_storage
-- Description: Storage bucket and policies for avatar assets
--
-- NOTE: This migration creates the 'avatars' bucket for storing:
-- - Anchor images (portrait, fullbody)
-- - Expression variants
-- - Pose variants
-- - Other avatar-related assets
--
-- If bucket creation fails, create manually via Dashboard:
--   1. Navigate to Storage -> Buckets
--   2. Create new bucket: avatars
--   3. Settings: Private (public: false), File size limit: 10MB
--   4. Then run this migration for RLS policies only

-- ============================================================================
-- STEP 1: Create storage bucket
-- ============================================================================

-- Insert bucket configuration
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  false, -- Private bucket (requires signed URLs or service role)
  10485760, -- 10MB in bytes (avatar images should be optimized)
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STEP 2: RLS Policies for avatars bucket
-- ============================================================================

-- Drop existing policies if they exist (idempotent migration)
DROP POLICY IF EXISTS "Authenticated users can read avatar assets" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage avatar assets" ON storage.objects;

-- Policy 1: All authenticated users can read avatar assets
-- (Avatars are shared character assets, not user-specific)
CREATE POLICY "Authenticated users can read avatar assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
  );

-- Policy 2: Service role has full access (for admin uploads)
-- Note: INSERT/UPDATE/DELETE for avatars is admin-only in MVP
CREATE POLICY "Service role can manage avatar assets"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'avatars');

-- ============================================================================
-- STEP 3: Ensure scenes bucket also has proper policies
-- (In case it was created manually without policies)
-- ============================================================================

-- Drop and recreate scenes policies for consistency
DROP POLICY IF EXISTS "Users can read their own scene images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own scene images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage scene images" ON storage.objects;

-- Users can read scene images from episodes they own
CREATE POLICY "Users can read their own scene images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'scenes'
    -- Path format: {user_id}/{episode_id}/{image_id}.png
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can upload scene images to their folder
CREATE POLICY "Users can upload their own scene images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'scenes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role has full access to scenes
CREATE POLICY "Service role can manage scene images"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'scenes');

-- ============================================================================
-- Storage path conventions:
-- ============================================================================
-- avatars bucket:
--   {kit_id}/anchors/{asset_id}.png        - Anchor images
--   {kit_id}/expressions/{asset_id}.png    - Expression variants
--   {kit_id}/poses/{asset_id}.png          - Pose variants
--
-- scenes bucket:
--   {user_id}/{episode_id}/{image_id}.png  - User scene outputs
-- ============================================================================
