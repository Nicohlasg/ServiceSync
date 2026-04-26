-- =============================================================================
-- Migration 004: Sprint 1 — Payment Integrity + Compliance
-- =============================================================================
-- Task 1.4: Add void columns to cash_payments
-- Task 1.5: Add pdpa_consent_at to profiles
-- Task 1.6: Add gst_registered to profiles
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. cash_payments: void support (Task 1.4)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE cash_payments ADD COLUMN voided_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cash_payments ADD COLUMN voided_by UUID REFERENCES profiles(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cash_payments ADD COLUMN void_reason TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. profiles: PDPA consent timestamp (Task 1.5)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN pdpa_consent_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3. profiles: GST registration flag (Task 1.6)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN gst_registered BOOLEAN NOT NULL DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
