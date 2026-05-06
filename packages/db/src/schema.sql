-- =============================================================================
-- ServiceSync — Base Schema (CANONICAL)
-- Version: 1.0
-- =============================================================================
-- This file is the single source of truth for the ServiceSync Postgres schema.
-- Supabase auth.users is managed by Supabase Auth automatically; this file
-- creates the application-level tables, indexes, and RLS policies.
--
-- Change procedure:
--   1. Update the table definition below.
--   2. Add a numbered migration under packages/db/migrations/ that brings an
--      existing deployment in line with the change. Migrations must be
--      idempotent (use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DO blocks).
--   3. Do NOT add another schema.sql elsewhere in the repo — a second schema
--      file caused KI-5, KI-9, and KI-11 (column-not-found errors caused by
--      the deployed DB having been seeded from a stale stub).

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. profiles — Technician profiles (extends auth.users)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  phone             TEXT NOT NULL,
  email             TEXT,
  bio               TEXT DEFAULT '',
  avatar_url        TEXT,
  banner_url        TEXT,

  -- Business info
  acra_registered   BOOLEAN NOT NULL DEFAULT FALSE,
  acra_uen          TEXT,
  acra_verified     BOOLEAN NOT NULL DEFAULT FALSE,

  -- PayNow
  paynow_key        TEXT,          -- NRIC or mobile for PayNow transfers
  paynow_key_type   TEXT CHECK (paynow_key_type IN ('nric', 'mobile', 'uen')),

  -- Location (base/home address for route optimization)
  base_address      TEXT,
  base_lat          DOUBLE PRECISION,
  base_lng          DOUBLE PRECISION,

  -- Working hours (JSON: { mon: { start: "09:00", end: "18:00" }, ... })
  working_hours     JSONB NOT NULL DEFAULT '{
    "mon": {"start": "09:00", "end": "18:00"},
    "tue": {"start": "09:00", "end": "18:00"},
    "wed": {"start": "09:00", "end": "18:00"},
    "thu": {"start": "09:00", "end": "18:00"},
    "fri": {"start": "09:00", "end": "18:00"},
    "sat": null,
    "sun": null
  }'::jsonb,

  -- Stats (denormalized for public profile)
  total_jobs        INTEGER NOT NULL DEFAULT 0,
  avg_rating        NUMERIC(3,2) DEFAULT 0,
  review_count      INTEGER NOT NULL DEFAULT 0,

  -- Compliance
  gst_registered         BOOLEAN NOT NULL DEFAULT FALSE,
  pdpa_consent_at        TIMESTAMPTZ,

  -- Onboarding (masterplan §4.1, §4.2, §4.3)
  preferred_locale       TEXT NOT NULL DEFAULT 'en-SG'
                         CHECK (preferred_locale IN ('en-SG', 'zh-Hans-SG', 'ms-SG', 'ta-SG')),
  tutorial_completed_at  TIMESTAMPTZ,
  onboarding_checklist   JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_slug ON profiles(slug);

-- Alias: "users" view for backward compat with existing code referencing users table
CREATE OR REPLACE VIEW users AS
  SELECT id, name FROM profiles;

-- Public-safe profile view for /p/{slug} page — excludes PII (paynow_key, phone, email, base_address)
CREATE OR REPLACE VIEW profiles_public AS
  SELECT
    id, slug, name, bio, avatar_url, banner_url,
    acra_registered, acra_uen, acra_verified,
    total_jobs, avg_rating, review_count,
    created_at
  FROM profiles;

-- -----------------------------------------------------------------------------
-- 2. services — Service types offered by each technician
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT DEFAULT '',
  duration_minutes  INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
  price_cents       INTEGER NOT NULL CHECK (price_cents >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id) WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- 3. clients — Homeowner records per technician
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  address           TEXT NOT NULL,
  unit_number       TEXT,              -- e.g. '#12-345', 'Blk 123'
  postal_code       TEXT,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  brand             TEXT DEFAULT '',
  notes             TEXT DEFAULT '',
  is_deleted        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_provider ON clients(provider_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(provider_id, phone);

-- -----------------------------------------------------------------------------
-- 4. client_assets — Equipment tracked per client (for retention reminders)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS client_assets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  asset_type          TEXT NOT NULL,       -- e.g. 'aircon', 'water_heater'
  brand               TEXT,
  model               TEXT,
  location_in_home    TEXT,               -- e.g. 'Master bedroom'
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

-- -----------------------------------------------------------------------------
-- 5. bookings — Job bookings with status lifecycle
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id         UUID NOT NULL REFERENCES profiles(id),
  client_id           UUID REFERENCES clients(id),
  service_id          UUID REFERENCES services(id),

  -- Booking details
  service_type        TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),

  -- Scheduling
  scheduled_date      DATE NOT NULL,
  arrival_window_start TIMESTAMPTZ,
  arrival_window_end  TIMESTAMPTZ,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 60,
  estimated_completion TIMESTAMPTZ,

  -- Location
  address             TEXT NOT NULL,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,

  -- Financials
  amount              INTEGER NOT NULL DEFAULT 0,    -- total in cents
  deposit_amount      INTEGER NOT NULL DEFAULT 0,    -- deposit in cents
  deposit_paid        BOOLEAN NOT NULL DEFAULT FALSE,

  -- Client info (for bookings from non-registered clients)
  client_name         TEXT,
  client_phone        TEXT,
  client_email        TEXT,

  -- Tracking
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  notes               TEXT DEFAULT '',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_provider_date
  ON bookings(provider_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_status
  ON bookings(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_client
  ON bookings(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_service
  ON bookings(service_id) WHERE service_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 6. booking_slots — Pre-computed arrival windows (for availability engine)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS booking_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id),
  booking_id        UUID REFERENCES bookings(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  is_available      BOOLEAN NOT NULL DEFAULT TRUE,
  locked_at         TIMESTAMPTZ,        -- For SELECT FOR UPDATE race condition handling
  locked_by         TEXT,               -- Session/request ID that locked this slot
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_availability
  ON booking_slots(provider_id, date, is_available)
  WHERE is_available = TRUE;

-- -----------------------------------------------------------------------------
-- 7. schedule_blocks — Blocked days/times (recurring + one-off)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schedule_blocks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  block_type        TEXT NOT NULL CHECK (block_type IN ('recurring', 'one_off', 'lunch')),

  -- For recurring blocks
  day_of_week       INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sun, 6=Sat

  -- For one-off blocks
  block_date        DATE,

  -- Time range (NULL = full day block)
  start_time        TIME,
  end_time          TIME,

  label             TEXT DEFAULT '',    -- e.g. 'Lunch break', 'Public holiday'
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_blocks_provider
  ON schedule_blocks(provider_id) WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- 8. invoices — Full invoice table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id),
  client_id         UUID REFERENCES clients(id),
  booking_id        UUID REFERENCES bookings(id),

  -- Invoice details
  invoice_number    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('draft', 'pending', 'awaiting_qr_confirmation', 'paid_cash', 'paid_qr', 'disputed', 'void')),

  -- Line items stored as JSONB array
  line_items        JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Amounts (all in cents)
  subtotal_cents    INTEGER NOT NULL DEFAULT 0,
  tax_cents         INTEGER NOT NULL DEFAULT 0,
  total_cents       INTEGER NOT NULL DEFAULT 0,
  amount            INTEGER NOT NULL DEFAULT 0,     -- alias for total_cents (backward compat)
  tax               INTEGER NOT NULL DEFAULT 0,     -- alias for tax_cents

  -- PayNow
  paynow_ref        TEXT,              -- EMVCo QR payload string
  paynow_qr_url     TEXT,             -- Data URL of rendered QR image

  -- PDF
  draft_pdf_url     TEXT,
  pdf_url           TEXT,

  -- Payment tracking
  paid_at           TIMESTAMPTZ,
  due_date          DATE,

  -- Metadata
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_provider ON invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id) WHERE booking_id IS NOT NULL;

-- Generate sequential invoice numbers per provider
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

CREATE TRIGGER trg_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

-- -----------------------------------------------------------------------------
-- 9. payments — Payment records (PayNow confirmations, etc.)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id),
  provider_id       UUID NOT NULL REFERENCES profiles(id),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('paynow_qr', 'cash', 'bank_transfer')),
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'failed', 'refunded')),
  reference         TEXT,              -- PayNow transaction ref or receipt number
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON payments(provider_id);

-- -----------------------------------------------------------------------------
-- 10. push_subscriptions — Web Push notification subscriptions
-- -----------------------------------------------------------------------------

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

-- Also support anonymous push subscriptions (for homeowners without accounts)
CREATE TABLE IF NOT EXISTS booking_push_subscriptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id        UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  endpoint          TEXT NOT NULL,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_push_subs ON booking_push_subscriptions(booking_id);

-- -----------------------------------------------------------------------------
-- 11. reviews — Client reviews for public profile
-- -----------------------------------------------------------------------------

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

-- -----------------------------------------------------------------------------
-- 12. Row-Level Security — Base tables
-- -----------------------------------------------------------------------------

ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE services              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_assets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Public profile read: restricted to safe columns via a view (see profiles_public below).
-- The direct table policy only allows the owner to SELECT their own row.
-- For anonymous/public access, use the profiles_public view instead.

-- Services: provider isolation
CREATE POLICY "services_provider_isolation" ON services
  FOR ALL USING (auth.uid() = provider_id);

-- Services: public read (for booking page)
CREATE POLICY "services_public_read" ON services
  FOR SELECT USING (is_active = TRUE);

-- Clients: provider isolation
CREATE POLICY "clients_provider_isolation" ON clients
  FOR ALL USING (auth.uid() = provider_id);

-- Client assets: provider isolation
CREATE POLICY "client_assets_provider_isolation" ON client_assets
  FOR ALL USING (auth.uid() = provider_id);

-- Bookings: provider can see all their bookings
CREATE POLICY "bookings_provider_isolation" ON bookings
  FOR ALL USING (auth.uid() = provider_id);

-- Bookings: public insert (homeowners creating bookings) — must reference a valid provider
CREATE POLICY "bookings_public_insert" ON bookings
  FOR INSERT WITH CHECK (
    provider_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = provider_id)
    AND status = 'pending'
  );

-- Booking slots: provider isolation
CREATE POLICY "booking_slots_provider_isolation" ON booking_slots
  FOR ALL USING (auth.uid() = provider_id);

-- Booking slots: public read (for availability checks)
CREATE POLICY "booking_slots_public_read" ON booking_slots
  FOR SELECT USING (TRUE);

-- Schedule blocks: provider isolation
CREATE POLICY "schedule_blocks_provider_isolation" ON schedule_blocks
  FOR ALL USING (auth.uid() = provider_id);

-- Invoices: provider isolation
CREATE POLICY "invoices_provider_isolation" ON invoices
  FOR ALL USING (auth.uid() = provider_id);

-- Payments: provider isolation
CREATE POLICY "payments_provider_isolation" ON payments
  FOR ALL USING (auth.uid() = provider_id);

-- Push subscriptions: user isolation
CREATE POLICY "push_subs_user_isolation" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Booking push subscriptions: public insert (homeowners subscribing) — must reference valid booking
CREATE POLICY "booking_push_subs_public_insert" ON booking_push_subscriptions
  FOR INSERT WITH CHECK (
    booking_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_id)
  );

-- Booking push subscriptions: provider can read via booking
CREATE POLICY "booking_push_subs_provider_read" ON booking_push_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_push_subscriptions.booking_id
      AND bookings.provider_id = auth.uid()
    )
  );

-- Reviews: public read
CREATE POLICY "reviews_public_read" ON reviews
  FOR SELECT USING (is_public = TRUE);

-- Reviews: provider can manage their reviews
CREATE POLICY "reviews_provider_isolation" ON reviews
  FOR ALL USING (auth.uid() = provider_id);

-- -----------------------------------------------------------------------------
-- 13. updated_at trigger function
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_client_assets_updated_at BEFORE UPDATE ON client_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schedule_blocks_updated_at BEFORE UPDATE ON schedule_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_push_subs_updated_at BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- ServiceSync — Cash Payment Schema Extensions
-- Version: 1.1 (extends base schema from servicecync-workflows.md)
-- =============================================================================
-- Run after the base schema migration that creates:
--   users, profiles, bookings, schedule, clients, client_assets,
--   invoices, payments, reminders

-- -----------------------------------------------------------------------------
-- 1. Extend invoices table with cash payment fields
-- -----------------------------------------------------------------------------

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'paynow_qr'
    CHECK (payment_method IN ('paynow_qr', 'cash', 'mixed')),
  ADD COLUMN IF NOT EXISTS cash_amount_collected_cents INTEGER,
  ADD COLUMN IF NOT EXISTS cash_collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMPTZ;

COMMENT ON COLUMN invoices.payment_method IS
  'paynow_qr = full payment via PayNow; cash = full balance collected in cash; mixed = deposit via PayNow + balance in cash';

-- -----------------------------------------------------------------------------
-- 2. cash_payments — one-to-one with invoices for cash-settled jobs
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cash_payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id                  UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  provider_id                 UUID NOT NULL REFERENCES profiles(id),
  client_id                   UUID NOT NULL REFERENCES clients(id),

  -- Amounts (all in cents to avoid floating-point)
  amount_due_cents            INTEGER NOT NULL CHECK (amount_due_cents > 0),
  amount_collected_cents      INTEGER NOT NULL CHECK (amount_collected_cents >= 0),
  adjustment_cents            INTEGER NOT NULL DEFAULT 0,
  -- Positive adjustment = tip (homeowner gave more)
  -- Negative adjustment = discount given by technician
  adjustment_reason           TEXT CHECK (adjustment_reason IN ('tip', 'discount', 'rounding')),

  -- WhatsApp digital handshake
  whatsapp_confirmation_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_message_id         TEXT,           -- Meta Graph API message ID

  -- Glass-screen signature (for jobs ≥ $500 in cash)
  signature_required          BOOLEAN NOT NULL DEFAULT FALSE,
  signature_data              TEXT,           -- Storage URL (public) of the PNG
  signature_confirmed_cents   INTEGER,        -- amount client signed off on
  signature_collected_at      TIMESTAMPTZ,
  -- SEC-M5: HMAC over (invoice_id, amount_collected_cents, signature_collected_at)
  -- signed with FIELD_ENCRYPTION_KEY. Binds the stored signature to the specific
  -- payment — prevents replaying an uploaded PNG against a different invoice/amount.
  signature_binding_hmac      TEXT,

  collected_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Void support (Task 1.4)
  voided_at                   TIMESTAMPTZ,
  voided_by                   UUID REFERENCES profiles(id),
  void_reason                 TEXT,

  CONSTRAINT cash_payments_unique_invoice UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_cash_payments_provider
  ON cash_payments(provider_id, collected_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_payments_client
  ON cash_payments(client_id);

-- -----------------------------------------------------------------------------
-- 3. till_entries — daily cash float ledger per technician
-- -----------------------------------------------------------------------------

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

CREATE INDEX IF NOT EXISTS idx_till_provider_date
  ON till_entries(provider_id, date DESC);

-- -----------------------------------------------------------------------------
-- 4. escrow_releases — audit trail for releasing deposits to technicians
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS escrow_releases (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              UUID NOT NULL REFERENCES invoices(id),
  booking_id              UUID NOT NULL REFERENCES bookings(id),
  provider_id             UUID NOT NULL REFERENCES profiles(id),

  deposit_amount_cents    INTEGER NOT NULL CHECK (deposit_amount_cents > 0),
  transaction_fee_cents   INTEGER NOT NULL DEFAULT 0 CHECK (transaction_fee_cents >= 0),
  net_released_cents      INTEGER NOT NULL,  -- deposit - fee

  destination_paynow_key  TEXT NOT NULL,     -- NRIC or mobile registered with PayNow
  triggered_by            TEXT NOT NULL
    CHECK (triggered_by IN ('cash_confirmed', 'paynow_paid')),

  status                  TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'released', 'failed')),

  initiated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at            TIMESTAMPTZ,
  failure_reason          TEXT,

  CONSTRAINT escrow_releases_unique_invoice UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_escrow_provider
  ON escrow_releases(provider_id, initiated_at DESC);

-- -----------------------------------------------------------------------------
-- 5. Row-Level Security — technicians see only their own records
-- -----------------------------------------------------------------------------

ALTER TABLE cash_payments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE till_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE escrow_releases   ENABLE ROW LEVEL SECURITY;

-- cash_payments
CREATE POLICY "cash_payments_provider_isolation" ON cash_payments
  FOR ALL USING (auth.uid() = provider_id);

-- till_entries
CREATE POLICY "till_entries_provider_isolation" ON till_entries
  FOR ALL USING (auth.uid() = provider_id);

-- escrow_releases
CREATE POLICY "escrow_releases_provider_isolation" ON escrow_releases
  FOR ALL USING (auth.uid() = provider_id);

-- -----------------------------------------------------------------------------
-- 6. Convenience view: daily till summary per provider
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW till_daily_summary AS
SELECT
  provider_id,
  date,
  SUM(amount_cents)                                            AS total_earned_cents,
  SUM(CASE WHEN entry_type = 'bank_transfer' THEN amount_cents ELSE 0 END)
                                                               AS bank_transfers_cents,
  SUM(CASE WHEN entry_type = 'cash_in'       THEN amount_cents ELSE 0 END)
                                                               AS cash_in_pocket_cents
FROM till_entries
GROUP BY provider_id, date;

COMMENT ON VIEW till_daily_summary IS
  'Used by the technician evening dashboard to show earnings split';

-- -----------------------------------------------------------------------------
-- 7. webhook_events — Idempotency log for external webhooks (SEC-L4)
-- -----------------------------------------------------------------------------
-- NETS/PayNow may retry the same callback on network errors. We fingerprint
-- each callback (source + transaction_id + hmac) and short-circuit duplicates
-- before executing side-effects (invoice update, escrow release, till entry).

CREATE TABLE IF NOT EXISTS webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          TEXT NOT NULL,                   -- e.g. 'paynow', 'nets'
  event_id        TEXT NOT NULL,                   -- provider-supplied unique id
  signature       TEXT,                            -- HMAC seen on the request
  payload_hash    TEXT,                            -- sha256 of raw body, for audit
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  result          TEXT,                            -- 'processed' | 'ignored' | 'error'

  UNIQUE (source, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_received
  ON webhook_events(source, received_at DESC);

COMMENT ON TABLE webhook_events IS
  'Idempotency ledger for NETS/PayNow callbacks — UNIQUE(source,event_id) prevents replay';

-- -----------------------------------------------------------------------------
-- 8. audit_log — Append-only trail of sensitive mutations (SEC-M3)
-- -----------------------------------------------------------------------------
-- Captures create / update / delete on bookings, invoices, clients,
-- cash_payments, and profile edits. Used for IRAS record-keeping and
-- dispute investigation. Rows are immutable.

CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES profiles(id),    -- NULL for system / webhook
  actor_ip        TEXT,
  entity_type     TEXT NOT NULL,                   -- 'booking' | 'invoice' | ...
  entity_id       UUID,
  action          TEXT NOT NULL,                   -- 'create' | 'update' | 'delete' | ...
  diff            JSONB,                           -- { before, after } or event payload
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON audit_log(actor_id, created_at DESC);

-- Enforce append-only: block UPDATE/DELETE on audit_log at the RLS layer.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_insert_any" ON audit_log
  FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_log_select_own" ON audit_log
  FOR SELECT USING (auth.uid() = actor_id);
-- No UPDATE / DELETE policies: rows are immutable for non-superusers.

COMMENT ON TABLE audit_log IS
  'Append-only audit trail for sensitive mutations (SEC-M3). IRAS record retention.';

-- =============================================================================
-- BETA-ONLY: REMOVE FOR PUBLIC LAUNCH
-- Tables 9-11: beta_bug_reports, beta_feature_requests, beta_feature_votes
-- Removal checklist:
--   1. DELETE apps/web/app/dashboard/feedback/ (entire directory)
--   2. DELETE packages/api/src/routers/beta.ts, remove its line from _app.ts
--   3. DELETE packages/api/src/services/beta-rewards.ts
--   4. DROP TABLE beta_feature_votes, beta_feature_requests, beta_bug_reports (in that order)
--   5. Remove the BETA-ONLY block from apps/web/app/dashboard/settings/page.tsx
--   6. Remove ADMIN_EMAILS from env
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 9. beta_bug_reports — Bug / feedback submissions from beta testers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS beta_bug_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  steps_to_reproduce TEXT,
  severity          TEXT NOT NULL DEFAULT 'med'
                    CHECK (severity IN ('low', 'med', 'high')),
  status            TEXT NOT NULL DEFAULT 'submitted'
                    CHECK (status IN ('submitted', 'verified', 'in_progress', 'fixed', 'rejected')),
  admin_note        TEXT,
  verified_at       TIMESTAMPTZ,
  verified_by       UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_bugs_provider ON beta_bug_reports(provider_id);
CREATE INDEX IF NOT EXISTS idx_beta_bugs_status   ON beta_bug_reports(status);

ALTER TABLE beta_bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_bugs_insert_own" ON beta_bug_reports
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "beta_bugs_select_authenticated" ON beta_bug_reports
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "beta_bugs_update_own_pending" ON beta_bug_reports
  FOR UPDATE USING (auth.uid() = provider_id AND status = 'submitted');

CREATE TRIGGER trg_beta_bugs_updated_at BEFORE UPDATE ON beta_bug_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE beta_bug_reports IS
  'BETA-ONLY: Bug and feedback submissions with admin verification workflow.';

-- -----------------------------------------------------------------------------
-- 10. beta_feature_requests — Feature ideas from beta testers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS beta_feature_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'planned', 'shipped', 'declined')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beta_features_provider ON beta_feature_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_beta_features_status   ON beta_feature_requests(status);

ALTER TABLE beta_feature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_features_insert_own" ON beta_feature_requests
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "beta_features_select_authenticated" ON beta_feature_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_beta_features_updated_at BEFORE UPDATE ON beta_feature_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE beta_feature_requests IS
  'BETA-ONLY: Feature requests from testers with community up/down voting.';

-- -----------------------------------------------------------------------------
-- 11. beta_feature_votes — One vote per user per feature (+1 / -1)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS beta_feature_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id  UUID NOT NULL REFERENCES beta_feature_requests(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  value       SMALLINT NOT NULL CHECK (value IN (1, -1)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_beta_votes_feature ON beta_feature_votes(feature_id);

ALTER TABLE beta_feature_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beta_votes_upsert_own" ON beta_feature_votes
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "beta_votes_update_own" ON beta_feature_votes
  FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "beta_votes_delete_own" ON beta_feature_votes
  FOR DELETE USING (auth.uid() = provider_id);
CREATE POLICY "beta_votes_select_authenticated" ON beta_feature_votes
  FOR SELECT USING (auth.uid() IS NOT NULL);

COMMENT ON TABLE beta_feature_votes IS
  'BETA-ONLY: One up/down vote per user per feature request. UNIQUE(feature_id, provider_id).';

-- -----------------------------------------------------------------------------
-- 12. service_plans — Recurring maintenance / service plans per client
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS service_plans (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id        UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_type     TEXT NOT NULL,
  interval_months  INTEGER NOT NULL CHECK (interval_months IN (1, 2, 3, 6, 12)),
  price_cents      INTEGER NOT NULL DEFAULT 0,
  next_due_date    DATE NOT NULL,
  last_serviced_at TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused', 'cancelled')),
  notes            TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_plans_provider ON service_plans(provider_id);
CREATE INDEX IF NOT EXISTS idx_service_plans_client   ON service_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_service_plans_due      ON service_plans(provider_id, next_due_date)
  WHERE status = 'active';

ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_select_own" ON service_plans
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "plans_insert_own" ON service_plans
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "plans_update_own" ON service_plans
  FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "plans_delete_own" ON service_plans
  FOR DELETE USING (auth.uid() = provider_id);

CREATE TRIGGER trg_service_plans_updated_at BEFORE UPDATE ON service_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE service_plans IS
  'Recurring maintenance plans linking a provider to a client with a service interval. '
  'next_due_date advances only when markServiced is called — technician controls timing.';

-- -----------------------------------------------------------------------------
-- 13. job_photos — Before/after/other photos attached to a booking
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS job_photos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  photo_type   TEXT NOT NULL DEFAULT 'other'
               CHECK (photo_type IN ('before', 'after', 'other')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_photos_booking ON job_photos(booking_id);
CREATE INDEX IF NOT EXISTS idx_job_photos_provider ON job_photos(provider_id);

ALTER TABLE job_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_photos_select_own" ON job_photos
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "job_photos_insert_own" ON job_photos
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "job_photos_delete_own" ON job_photos
  FOR DELETE USING (auth.uid() = provider_id);

COMMENT ON TABLE job_photos IS
  'Before/after/other photos taken at a job site. storage_path is the Supabase Storage key '
  'inside the job-photos bucket. Provider uploads from the browser, records path here.';

-- -----------------------------------------------------------------------------
-- 14. job_checklist_items — Per-job checklist items
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS job_checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  is_checked  BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_booking ON job_checklist_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_checklist_provider ON job_checklist_items(provider_id);

ALTER TABLE job_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "checklist_select_own" ON job_checklist_items
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "checklist_insert_own" ON job_checklist_items
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "checklist_update_own" ON job_checklist_items
  FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "checklist_delete_own" ON job_checklist_items
  FOR DELETE USING (auth.uid() = provider_id);

COMMENT ON TABLE job_checklist_items IS
  'Technician checklist items per booking. sort_order determines display order.';

-- -----------------------------------------------------------------------------
-- 15. quotes — Estimates / quotes sent to clients before invoicing
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quotes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id      UUID REFERENCES clients(id) ON DELETE SET NULL,
  booking_id     UUID REFERENCES bookings(id) ON DELETE SET NULL,
  quote_number   TEXT NOT NULL DEFAULT '',
  line_items     JSONB NOT NULL DEFAULT '[]',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents      INTEGER NOT NULL DEFAULT 0,
  total_cents    INTEGER NOT NULL DEFAULT 0,
  notes          TEXT NOT NULL DEFAULT '',
  valid_until    DATE,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_provider ON quotes(provider_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client   ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status   ON quotes(provider_id, status);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotes_select_own" ON quotes
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "quotes_insert_own" ON quotes
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "quotes_update_own" ON quotes
  FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "quotes_delete_own" ON quotes
  FOR DELETE USING (auth.uid() = provider_id);

CREATE TRIGGER trg_quotes_updated_at BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE quotes IS
  'Client quotes/estimates. Accepted quotes convert to invoices via convertToInvoice. '
  'quote_number is set by the create mutation (Q-XXXX format).';

-- -----------------------------------------------------------------------------
-- 16. expenses — Per-job cost tracking (parts, fuel, labour, other)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  category    TEXT NOT NULL DEFAULT 'other'
              CHECK (category IN ('parts', 'fuel', 'labour', 'other')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_booking  ON expenses(booking_id);
CREATE INDEX IF NOT EXISTS idx_expenses_provider ON expenses(provider_id);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select_own" ON expenses
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "expenses_insert_own" ON expenses
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "expenses_delete_own" ON expenses
  FOR DELETE USING (auth.uid() = provider_id);

COMMENT ON TABLE expenses IS
  'Per-job cost items (parts, fuel, labour, other). '
  'Profit = booking.amount - SUM(expenses.amount_cents) for a given booking.';

-- -----------------------------------------------------------------------------
-- 17. inventory_items — Technician stock catalog (what they keep on hand)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_items (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id      UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  category         TEXT          NOT NULL DEFAULT 'other'
                                 CHECK (category IN ('refrigerant','chemical','filter','part','tool','consumable','other')),
  unit             TEXT          NOT NULL DEFAULT 'piece',
  quantity_on_hand NUMERIC(10,2) NOT NULL DEFAULT 0,
  min_quantity     NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_quantity     NUMERIC(10,2)             DEFAULT NULL,
  unit_cost_cents  INTEGER       NOT NULL DEFAULT 0,
  supplier_name    TEXT,
  supplier_contact TEXT,
  notes            TEXT,
  status           TEXT          NOT NULL DEFAULT 'active'
                                 CHECK (status IN ('active','archived')),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_provider        ON inventory_items(provider_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_provider_status ON inventory_items(provider_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category        ON inventory_items(provider_id, category);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_items_select_own" ON inventory_items
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "inventory_items_insert_own" ON inventory_items
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "inventory_items_update_own" ON inventory_items
  FOR UPDATE USING (auth.uid() = provider_id);
CREATE POLICY "inventory_items_delete_own" ON inventory_items
  FOR DELETE USING (auth.uid() = provider_id);

CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE inventory_items IS
  'Stock items tracked per service provider. '
  'quantity_on_hand is the denormalized current count, updated on every inventory_transaction. '
  'min_quantity = 0 means no reorder alert. unit = piece/kg/litre/roll/bottle/set/pair/metre.';

-- -----------------------------------------------------------------------------
-- 18. inventory_transactions — Immutable ledger of all stock movements
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id         UUID          NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  type            TEXT          NOT NULL
                                CHECK (type IN ('stock_in','stock_out','adjustment','waste')),
  quantity        NUMERIC(10,2) NOT NULL,
  booking_id      UUID          REFERENCES bookings(id) ON DELETE SET NULL,
  unit_cost_cents INTEGER       NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_txn_provider ON inventory_transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_item     ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inv_txn_booking  ON inventory_transactions(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_txn_created  ON inventory_transactions(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_txn_type     ON inventory_transactions(provider_id, type, created_at DESC);

ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_txn_select_own" ON inventory_transactions
  FOR SELECT USING (auth.uid() = provider_id);
CREATE POLICY "inv_txn_insert_own" ON inventory_transactions
  FOR INSERT WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "inv_txn_delete_own" ON inventory_transactions
  FOR DELETE USING (auth.uid() = provider_id);

COMMENT ON TABLE inventory_transactions IS
  'Immutable ledger of all stock movements. quantity is signed: positive = in, negative = out. '
  'booking_id links stock_out transactions to the job where items were consumed. '
  'Reconstruct stock level at any point in time = SUM(quantity) up to that date.';
