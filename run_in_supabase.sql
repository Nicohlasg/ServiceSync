-- 1. Add banner_url to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- 2. Drop the existing view first because PostgreSQL cannot insert a column in the middle of a view
DROP VIEW IF EXISTS profiles_public;

-- 3. Recreate the view correctly
CREATE VIEW profiles_public AS
  SELECT
    id, slug, name, bio, avatar_url, banner_url,
    acra_registered, acra_uen, acra_verified,
    total_jobs, avg_rating, review_count,
    created_at
  FROM profiles;

-- 4. Setup RLS policies for storage to allow avatar/banner uploads
-- Allow public viewing of files
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload files
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- Allow users to update their own files
CREATE POLICY "Auth Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars' AND owner = auth.uid());

-- =============================================================================
-- Migration 003 — Relax legacy NOT NULL constraints
-- Run this in the Supabase SQL Editor to fix the price_sgd and scheduled_at errors.
-- =============================================================================

-- 1. SERVICES — make price_sgd nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'price_sgd'
  ) THEN
    ALTER TABLE public.services ALTER COLUMN price_sgd DROP NOT NULL;
    ALTER TABLE public.services ALTER COLUMN price_sgd SET DEFAULT 0;
    UPDATE public.services
       SET price_sgd = ROUND(price_cents / 100.0, 2)
     WHERE price_sgd IS NULL AND price_cents IS NOT NULL;
  END IF;
END $$;

-- 2. BOOKINGS — make scheduled_at nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'scheduled_at'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN scheduled_at DROP NOT NULL;
    ALTER TABLE public.bookings ALTER COLUMN scheduled_at SET DEFAULT NOW();
    UPDATE public.bookings
       SET scheduled_at = (scheduled_date::timestamp AT TIME ZONE 'Asia/Singapore')
     WHERE scheduled_at IS NULL AND scheduled_date IS NOT NULL;
  END IF;
END $$;
