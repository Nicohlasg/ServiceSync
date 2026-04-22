-- =============================================================================
-- Migration 003 — Relax legacy NOT NULL constraints
--
-- The live Supabase DB still has legacy columns `price_sgd` (on services)
-- and `scheduled_at` (on bookings) with NOT NULL constraints. The application
-- code now uses `price_cents` and `scheduled_date` exclusively, but the old
-- columns block inserts when they are not supplied.
--
-- This migration makes the legacy columns nullable so inserts succeed, then
-- backfills them from the canonical columns for consistency.
--
-- Idempotent: safe to re-run.
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. SERVICES — make price_sgd nullable and backfill from price_cents
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'price_sgd'
  ) THEN
    -- Drop the NOT NULL constraint
    ALTER TABLE public.services ALTER COLUMN price_sgd DROP NOT NULL;

    -- Set a sensible default so future inserts don't need to supply it
    ALTER TABLE public.services ALTER COLUMN price_sgd SET DEFAULT 0;

    -- Backfill any NULLs from the canonical price_cents column
    UPDATE public.services
       SET price_sgd = ROUND(price_cents / 100.0, 2)
     WHERE price_sgd IS NULL AND price_cents IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 2. BOOKINGS — make scheduled_at nullable and backfill from scheduled_date
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'scheduled_at'
  ) THEN
    -- Drop the NOT NULL constraint
    ALTER TABLE public.bookings ALTER COLUMN scheduled_at DROP NOT NULL;

    -- Set a sensible default so future inserts don't need to supply it
    ALTER TABLE public.bookings ALTER COLUMN scheduled_at SET DEFAULT NOW();

    -- Backfill any NULLs from the canonical scheduled_date column
    UPDATE public.bookings
       SET scheduled_at = (scheduled_date::timestamp AT TIME ZONE 'Asia/Singapore')
     WHERE scheduled_at IS NULL AND scheduled_date IS NOT NULL;
  END IF;
END $$;

COMMIT;
