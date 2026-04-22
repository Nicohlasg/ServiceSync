-- Onboarding masterplan v1.0, Task P0-1
-- Adds locale + onboarding progress persistence to profiles so suppression
-- and language preference survive PWA reinstalls and device switches.
--
-- Columns:
--   preferred_locale        BCP-47 tag: 'en-SG' | 'zh-Hans-SG' | 'ms-SG' | 'ta-SG'
--   tutorial_completed_at   Set once the 7-step guided tour is fully finished
--                           (skips stay per-device so user can rediscover).
--   onboarding_checklist    Per-user booleans for the post-tour activation
--                           checklist: first_service, first_client, paynow_preview,
--                           plus dismissed_at / hidden_at timestamps.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT NOT NULL DEFAULT 'en-SG';

ALTER TABLE profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (preferred_locale IN ('en-SG', 'zh-Hans-SG', 'ms-SG', 'ta-SG'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tutorial_completed_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_checklist JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Index is intentionally omitted: these columns are always read via the
-- row-owner RLS policy (profiles_own) on primary key lookup — no scans.

-- RLS is already enabled on profiles and profiles_own covers SELECT/UPDATE
-- for auth.uid() = id. New columns inherit that policy automatically.

COMMENT ON COLUMN profiles.preferred_locale IS
  'BCP-47 locale tag chosen by the user in landing/signup/wizard/profile. Authoritative over localStorage.';

COMMENT ON COLUMN profiles.tutorial_completed_at IS
  'Timestamp when the 7-step onboarding tour reached step 7 → Start. NULL = not yet completed. Skips are not recorded here.';

COMMENT ON COLUMN profiles.onboarding_checklist IS
  'Per-user activation checklist state. Shape: { first_service?: bool, first_client?: bool, paynow_preview?: bool, hidden_at?: timestamptz, dismissed_at?: timestamptz }.';
