-- =============================================================================
-- Migration 002 — Align ALL tables with canonical schema
--
-- The live Supabase DB was seeded from the legacy apply-schema.mjs stub.
-- This migration adds every missing column and table so the deployed DB
-- matches packages/db/src/schema.sql exactly.
--
-- Idempotent: safe to re-run (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- =============================================================================

BEGIN;

-- ============================================================================
-- 1. PROFILES — add missing columns
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS acra_registered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acra_uen TEXT,
  ADD COLUMN IF NOT EXISTS acra_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS paynow_key TEXT,
  ADD COLUMN IF NOT EXISTS paynow_key_type TEXT,
  ADD COLUMN IF NOT EXISTS base_address TEXT,
  ADD COLUMN IF NOT EXISTS base_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS base_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '{
    "mon": {"start": "09:00", "end": "18:00"},
    "tue": {"start": "09:00", "end": "18:00"},
    "wed": {"start": "09:00", "end": "18:00"},
    "thu": {"start": "09:00", "end": "18:00"},
    "fri": {"start": "09:00", "end": "18:00"},
    "sat": null,
    "sun": null
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS total_jobs INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill name from full_name if full_name exists and name is empty
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    UPDATE public.profiles SET name = full_name WHERE name IS NULL AND full_name IS NOT NULL;
  END IF;
END $$;

-- Backfill phone from phone_number
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    UPDATE public.profiles SET phone = phone_number WHERE phone IS NULL AND phone_number IS NOT NULL;
  END IF;
END $$;

-- Backfill paynow_key from paynow_number
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'paynow_number'
  ) THEN
    UPDATE public.profiles SET paynow_key = paynow_number WHERE paynow_key IS NULL AND paynow_number IS NOT NULL;
  END IF;
END $$;

-- Default remaining NULLs so the app doesn't break
UPDATE public.profiles SET name = COALESCE(name, email, 'Unknown') WHERE name IS NULL;
UPDATE public.profiles SET phone = '' WHERE phone IS NULL;

-- ============================================================================
-- 2. SERVICES — add missing columns
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill price_cents from price_sgd (convert dollars to cents)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'price_sgd'
  ) THEN
    UPDATE public.services
       SET price_cents = (price_sgd * 100)::INTEGER
     WHERE price_cents IS NULL AND price_sgd IS NOT NULL;
  END IF;
END $$;

UPDATE public.services SET price_cents = 0 WHERE price_cents IS NULL;
ALTER TABLE public.services ALTER COLUMN price_cents SET NOT NULL;

-- ============================================================================
-- 3. CLIENTS — add missing columns
-- ============================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill address from legacy address fields
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'address_block'
  ) THEN
    UPDATE public.clients
       SET address = COALESCE(
         NULLIF(TRIM(
           COALESCE(address_block, '') || ' ' ||
           COALESCE(address_street, '') || ' ' ||
           COALESCE(address_unit, '')
         ), ''),
         'No address'
       )
     WHERE address IS NULL;
  END IF;
END $$;

-- Backfill postal_code from address_postal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'address_postal'
  ) THEN
    UPDATE public.clients SET postal_code = address_postal WHERE postal_code IS NULL AND address_postal IS NOT NULL;
  END IF;
END $$;

UPDATE public.clients SET address = 'No address' WHERE address IS NULL;

-- ============================================================================
-- 4. BOOKINGS — add ALL missing columns (scheduled_date was done in 001)
-- ============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS arrival_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS arrival_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS estimated_completion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_phone TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill service_type from services table if possible
UPDATE public.bookings b
   SET service_type = COALESCE(s.name, 'General Service')
  FROM public.services s
 WHERE b.service_id = s.id
   AND b.service_type IS NULL;
UPDATE public.bookings SET service_type = 'General Service' WHERE service_type IS NULL;

-- Backfill address from clients table if possible
UPDATE public.bookings b
   SET address = COALESCE(c.address, 'No address')
  FROM public.clients c
 WHERE b.client_id = c.id
   AND b.address IS NULL;
UPDATE public.bookings SET address = 'No address' WHERE address IS NULL;

-- Update status CHECK constraint to match canonical values
-- Drop old constraint if it exists, then add new one
DO $$
BEGIN
  -- Try to drop any existing check constraint on status
  BEGIN
    ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  -- Add canonical check constraint
  BEGIN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check
      CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Update any 'confirmed' status values to 'accepted' (legacy -> canonical)
UPDATE public.bookings SET status = 'accepted' WHERE status = 'confirmed';

-- ============================================================================
-- 5. INVOICES — add ALL missing columns
-- ============================================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paynow_ref TEXT,
  ADD COLUMN IF NOT EXISTS paynow_qr_url TEXT,
  ADD COLUMN IF NOT EXISTS draft_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'paynow_qr',
  ADD COLUMN IF NOT EXISTS cash_amount_collected_cents INTEGER,
  ADD COLUMN IF NOT EXISTS cash_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMPTZ;

-- Backfill amount from amount_sgd (convert dollars to cents)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'amount_sgd'
  ) THEN
    UPDATE public.invoices
       SET amount = (amount_sgd * 100)::INTEGER,
           subtotal_cents = (amount_sgd * 100)::INTEGER,
           total_cents = (amount_sgd * 100)::INTEGER
     WHERE amount = 0 AND amount_sgd IS NOT NULL AND amount_sgd > 0;
  END IF;
END $$;

-- Backfill paynow_ref from paynow_qr_string
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'paynow_qr_string'
  ) THEN
    UPDATE public.invoices SET paynow_ref = paynow_qr_string WHERE paynow_ref IS NULL AND paynow_qr_string IS NOT NULL;
  END IF;
END $$;

-- Generate invoice_number for rows that don't have one
DO $$
DECLARE
  r RECORD;
  counter INTEGER := 1000;
BEGIN
  FOR r IN (
    SELECT id FROM public.invoices
    WHERE invoice_number IS NULL
    ORDER BY created_at
  ) LOOP
    counter := counter + 1;
    UPDATE public.invoices SET invoice_number = 'INV-' || LPAD(counter::TEXT, 4, '0') WHERE id = r.id;
  END LOOP;
END $$;

-- Update status CHECK to canonical values
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
      CHECK (status IN ('draft', 'pending', 'awaiting_qr_confirmation', 'paid_cash', 'paid_qr', 'disputed', 'void'));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Map legacy 'unpaid' -> 'pending', 'paid' -> 'paid_qr'
UPDATE public.invoices SET status = 'pending' WHERE status = 'unpaid';
UPDATE public.invoices SET status = 'paid_qr' WHERE status = 'paid';

-- ============================================================================
-- 6. Create invoice_number trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 'INV-(\d+)') AS INTEGER)
  ), 999) + 1
  INTO next_num
  FROM invoices
  WHERE provider_id = NEW.provider_id;

  NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_invoice_number ON invoices;
CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

-- ============================================================================
-- 7. Create missing tables
-- ============================================================================

-- client_assets
CREATE TABLE IF NOT EXISTS client_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_type          TEXT NOT NULL,
  brand               TEXT,
  model               TEXT,
  location_in_home    TEXT,
  install_date        DATE,
  last_service_date   TIMESTAMPTZ,
  next_service_date   TIMESTAMPTZ,
  service_interval_days INTEGER DEFAULT 90,
  notes               TEXT DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_assets_client ON client_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_next_service ON client_assets(provider_id, next_service_date)
  WHERE next_service_date IS NOT NULL;

-- booking_slots
CREATE TABLE IF NOT EXISTS booking_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id),
  booking_id        UUID REFERENCES bookings(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  is_available      BOOLEAN NOT NULL DEFAULT TRUE,
  locked_at         TIMESTAMPTZ,
  locked_by         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_slots_availability
  ON booking_slots(provider_id, date, is_available) WHERE is_available = TRUE;

-- schedule_blocks
CREATE TABLE IF NOT EXISTS schedule_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_type        TEXT NOT NULL CHECK (block_type IN ('recurring', 'one_off', 'lunch')),
  day_of_week       INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  block_date        DATE,
  start_time        TIME,
  end_time          TIME,
  label             TEXT DEFAULT '',
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_provider
  ON schedule_blocks(provider_id) WHERE is_active = TRUE;

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id),
  provider_id       UUID NOT NULL REFERENCES profiles(id),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('paynow_qr', 'cash', 'bank_transfer')),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  reference         TEXT,
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider_id);

-- push_subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint          TEXT NOT NULL UNIQUE,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  user_agent        TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id) WHERE is_active = TRUE;

-- booking_push_subscriptions
CREATE TABLE IF NOT EXISTS booking_push_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  endpoint          TEXT NOT NULL,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_push_subs ON booking_push_subscriptions(booking_id);

-- reviews
CREATE TABLE IF NOT EXISTS reviews (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id),
  booking_id        UUID REFERENCES bookings(id),
  client_name       TEXT NOT NULL,
  rating            INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment           TEXT DEFAULT '',
  is_public         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id) WHERE is_public = TRUE;

-- cash_payments
CREATE TABLE IF NOT EXISTS cash_payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id                  UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  provider_id                 UUID NOT NULL REFERENCES profiles(id),
  client_id                   UUID NOT NULL REFERENCES clients(id),
  amount_due_cents            INTEGER NOT NULL CHECK (amount_due_cents > 0),
  amount_collected_cents      INTEGER NOT NULL CHECK (amount_collected_cents >= 0),
  adjustment_cents            INTEGER NOT NULL DEFAULT 0,
  adjustment_reason           TEXT CHECK (adjustment_reason IN ('tip', 'discount', 'rounding')),
  whatsapp_confirmation_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_message_id         TEXT,
  signature_required          BOOLEAN NOT NULL DEFAULT FALSE,
  signature_data              TEXT,
  signature_confirmed_cents   INTEGER,
  signature_collected_at      TIMESTAMPTZ,
  signature_binding_hmac      TEXT,
  collected_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_payments_unique_invoice UNIQUE (invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_cash_payments_provider ON cash_payments(provider_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_payments_client ON cash_payments(client_id);

-- till_entries
CREATE TABLE IF NOT EXISTS till_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(id),
  invoice_id  UUID REFERENCES invoices(id),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  entry_type   TEXT NOT NULL CHECK (entry_type IN ('cash_in', 'bank_transfer')),
  description  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_till_provider_date ON till_entries(provider_id, date DESC);

-- escrow_releases
CREATE TABLE IF NOT EXISTS escrow_releases (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              UUID NOT NULL REFERENCES invoices(id),
  booking_id              UUID NOT NULL REFERENCES bookings(id),
  provider_id             UUID NOT NULL REFERENCES profiles(id),
  deposit_amount_cents    INTEGER NOT NULL CHECK (deposit_amount_cents > 0),
  transaction_fee_cents   INTEGER NOT NULL DEFAULT 0 CHECK (transaction_fee_cents >= 0),
  net_released_cents      INTEGER NOT NULL,
  destination_paynow_key  TEXT NOT NULL,
  triggered_by            TEXT NOT NULL CHECK (triggered_by IN ('cash_confirmed', 'paynow_paid')),
  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'released', 'failed')),
  initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  failure_reason          TEXT,
  CONSTRAINT escrow_releases_unique_invoice UNIQUE (invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_escrow_provider ON escrow_releases(provider_id, initiated_at DESC);

-- webhook_events
CREATE TABLE IF NOT EXISTS webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,
  event_id        TEXT NOT NULL,
  signature       TEXT,
  payload_hash    TEXT,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  result          TEXT,
  UNIQUE (source, event_id)
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received ON webhook_events(source, received_at DESC);

-- audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES profiles(id),
  actor_ip        TEXT,
  entity_type     TEXT NOT NULL,
  entity_id       UUID,
  action          TEXT NOT NULL,
  diff            JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at DESC);

-- ============================================================================
-- 8. RLS on new tables
-- ============================================================================

ALTER TABLE client_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE till_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_releases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log             ENABLE ROW LEVEL SECURITY;

-- RLS Policies (DROP IF EXISTS to be idempotent)

-- client_assets
DROP POLICY IF EXISTS "client_assets_provider_isolation" ON client_assets;
CREATE POLICY "client_assets_provider_isolation" ON client_assets FOR ALL USING (auth.uid() = provider_id);

-- booking_slots
DROP POLICY IF EXISTS "booking_slots_provider_isolation" ON booking_slots;
CREATE POLICY "booking_slots_provider_isolation" ON booking_slots FOR ALL USING (auth.uid() = provider_id);
DROP POLICY IF EXISTS "booking_slots_public_read" ON booking_slots;
CREATE POLICY "booking_slots_public_read" ON booking_slots FOR SELECT USING (TRUE);

-- schedule_blocks
DROP POLICY IF EXISTS "schedule_blocks_provider_isolation" ON schedule_blocks;
CREATE POLICY "schedule_blocks_provider_isolation" ON schedule_blocks FOR ALL USING (auth.uid() = provider_id);

-- payments
DROP POLICY IF EXISTS "payments_provider_isolation" ON payments;
CREATE POLICY "payments_provider_isolation" ON payments FOR ALL USING (auth.uid() = provider_id);

-- push_subscriptions
DROP POLICY IF EXISTS "push_subs_user_isolation" ON push_subscriptions;
CREATE POLICY "push_subs_user_isolation" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- booking_push_subscriptions
DROP POLICY IF EXISTS "booking_push_subs_public_insert" ON booking_push_subscriptions;
CREATE POLICY "booking_push_subs_public_insert" ON booking_push_subscriptions
  FOR INSERT WITH CHECK (booking_id IS NOT NULL AND EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id));
DROP POLICY IF EXISTS "booking_push_subs_provider_read" ON booking_push_subscriptions;
CREATE POLICY "booking_push_subs_provider_read" ON booking_push_subscriptions
  FOR SELECT USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_push_subscriptions.booking_id AND bookings.provider_id = auth.uid()));

-- reviews
DROP POLICY IF EXISTS "reviews_public_read" ON reviews;
CREATE POLICY "reviews_public_read" ON reviews FOR SELECT USING (is_public = TRUE);
DROP POLICY IF EXISTS "reviews_provider_isolation" ON reviews;
CREATE POLICY "reviews_provider_isolation" ON reviews FOR ALL USING (auth.uid() = provider_id);

-- cash_payments
DROP POLICY IF EXISTS "cash_payments_provider_isolation" ON cash_payments;
CREATE POLICY "cash_payments_provider_isolation" ON cash_payments FOR ALL USING (auth.uid() = provider_id);

-- till_entries
DROP POLICY IF EXISTS "till_entries_provider_isolation" ON till_entries;
CREATE POLICY "till_entries_provider_isolation" ON till_entries FOR ALL USING (auth.uid() = provider_id);

-- escrow_releases
DROP POLICY IF EXISTS "escrow_releases_provider_isolation" ON escrow_releases;
CREATE POLICY "escrow_releases_provider_isolation" ON escrow_releases FOR ALL USING (auth.uid() = provider_id);

-- audit_log
DROP POLICY IF EXISTS "audit_log_insert_any" ON audit_log;
CREATE POLICY "audit_log_insert_any" ON audit_log FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "audit_log_select_own" ON audit_log;
CREATE POLICY "audit_log_select_own" ON audit_log FOR SELECT USING (auth.uid() = actor_id);

-- Bookings: public insert policy (for homeowners creating bookings)
DROP POLICY IF EXISTS "bookings_public_insert" ON bookings;
CREATE POLICY "bookings_public_insert" ON bookings
  FOR INSERT WITH CHECK (
    provider_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = provider_id)
    AND status = 'pending'
  );

-- ============================================================================
-- 9. updated_at trigger function & triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_services_updated_at ON services;
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_client_assets_updated_at ON client_assets;
CREATE TRIGGER trg_client_assets_updated_at BEFORE UPDATE ON client_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_schedule_blocks_updated_at ON schedule_blocks;
CREATE TRIGGER trg_schedule_blocks_updated_at BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_invoices_updated_at ON invoices;
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_push_subs_updated_at ON push_subscriptions;
CREATE TRIGGER trg_push_subs_updated_at BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 10. Views
-- ============================================================================

CREATE OR REPLACE VIEW users AS
  SELECT id, name FROM profiles;

CREATE OR REPLACE VIEW profiles_public AS
  SELECT
    id, slug, name, bio, avatar_url,
    acra_registered, acra_uen, acra_verified,
    total_jobs, avg_rating, review_count,
    created_at
  FROM profiles;

CREATE OR REPLACE VIEW till_daily_summary AS
SELECT
  provider_id,
  date,
  SUM(amount_cents) AS total_earned_cents,
  SUM(CASE WHEN entry_type = 'bank_transfer' THEN amount_cents ELSE 0 END) AS bank_transfers_cents,
  SUM(CASE WHEN entry_type = 'cash_in' THEN amount_cents ELSE 0 END) AS cash_in_pocket_cents
FROM till_entries
GROUP BY provider_id, date;

-- ============================================================================
-- 11. Additional indexes from canonical schema
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug);
CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clients_provider ON clients(provider_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(provider_id, phone);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_status ON bookings(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_provider ON invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id) WHERE booking_id IS NOT NULL;

COMMIT;
