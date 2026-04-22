-- -----------------------------------------------------------------------------
-- Migration 001 — Align bookings.scheduled_date with canonical schema
--
-- Fixes KI-11: `listBookings` failed with
--   column bookings.scheduled_date does not exist
-- because the deployed Supabase project was seeded from the legacy stub
-- `apps/web/src/supabase/schema.sql` (which used `scheduled_at TIMESTAMPTZ`)
-- rather than the canonical `packages/db/src/schema.sql`
-- (which uses `scheduled_date DATE NOT NULL`).
--
-- Idempotent: safe to re-run. Backfills from `scheduled_at` if that legacy
-- column is present, otherwise defaults remaining rows to CURRENT_DATE so
-- the NOT NULL constraint can be applied.
-- -----------------------------------------------------------------------------

BEGIN;

-- 1. Add the canonical column if it doesn't already exist.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS scheduled_date DATE;

-- 2. If the legacy `scheduled_at` column is still present, use it as the
--    source of truth and project it into SGT (Asia/Singapore) before
--    casting to DATE. SGT is used because operational day boundaries for
--    Singapore tradesmen are local, not UTC.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'bookings'
      AND column_name  = 'scheduled_at'
  ) THEN
    UPDATE public.bookings
       SET scheduled_date = (scheduled_at AT TIME ZONE 'Asia/Singapore')::date
     WHERE scheduled_date IS NULL;
  END IF;
END $$;

-- 3. Any remaining NULLs (rows without scheduled_at and without a backfilled
--    value) get today's date so NOT NULL can be applied safely. This should
--    only affect dev/test data.
UPDATE public.bookings
   SET scheduled_date = CURRENT_DATE
 WHERE scheduled_date IS NULL;

-- 4. Enforce NOT NULL to match the canonical schema.
ALTER TABLE public.bookings
  ALTER COLUMN scheduled_date SET NOT NULL;

-- 5. Recreate the canonical index used by listBookings / availability checks.
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date
  ON public.bookings(provider_id, scheduled_date);

COMMIT;
