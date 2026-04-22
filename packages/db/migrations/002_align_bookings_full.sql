-- -----------------------------------------------------------------------------
-- Migration 002 — Align bookings schema with canonical (full column set)
--
-- Fixes KI-14: `schedule.createJob` failed with
--   Could not find the 'address' column of 'bookings' in the schema cache
-- Same root cause as KI-11: the deployed Supabase project was seeded from the
-- legacy stub `apps/web/src/supabase/schema.sql` (now deleted) which only
-- carried a tiny subset of columns. This migration adds every remaining
-- column the canonical `packages/db/src/schema.sql` declares on `bookings`.
--
-- Idempotent: every column is guarded by ADD COLUMN IF NOT EXISTS. Existing
-- rows get conservative defaults before any NOT NULL constraints are applied
-- so the migration never rejects legacy data.
-- -----------------------------------------------------------------------------

BEGIN;

-- Scheduling windows (nullable — only populated once the job is accepted)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS arrival_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrival_window_end   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_completion TIMESTAMPTZ;

-- Duration — needed for availability checks
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER NOT NULL DEFAULT 60;

-- Service type (free-text label shown in lists and invoices). Canonical schema
-- marks this NOT NULL; backfill existing rows with a safe placeholder before
-- enforcing the constraint.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_type TEXT;
UPDATE public.bookings SET service_type = 'Service' WHERE service_type IS NULL;
ALTER TABLE public.bookings ALTER COLUMN service_type SET NOT NULL;

-- Location. Canonical schema marks address NOT NULL; apply the same backfill
-- pattern. lat/lng stay nullable (geocoding is opportunistic).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng     DOUBLE PRECISION;
UPDATE public.bookings SET address = '' WHERE address IS NULL;
ALTER TABLE public.bookings ALTER COLUMN address SET NOT NULL;

-- Financials (all in cents). Default 0 lets us add NOT NULL without backfill.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS amount         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid   BOOLEAN NOT NULL DEFAULT FALSE;

-- Denormalised client contact (for bookings created before a client record
-- exists — public booking flow). All nullable.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS client_name  TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT;

-- Lifecycle tracking
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS started_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS notes         TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Status CHECK constraint (no-op if already compatible).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_schema = 'public'
      AND constraint_name   = 'bookings_status_check'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled'));
  END IF;
END $$;

-- Indexes used by availability and list queries.
CREATE INDEX IF NOT EXISTS idx_bookings_provider_status
  ON public.bookings(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_client
  ON public.bookings(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_service
  ON public.bookings(service_id) WHERE service_id IS NOT NULL;

COMMIT;

-- PostgREST caches the schema. Reload it so new columns are visible without
-- redeploying the API gateway.
NOTIFY pgrst, 'reload schema';
