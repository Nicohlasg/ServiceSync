ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;

CREATE OR REPLACE VIEW profiles_public AS
  SELECT
    id, slug, name, bio, avatar_url, banner_url,
    acra_registered, acra_uen, acra_verified,
    total_jobs, avg_rating, review_count,
    created_at
  FROM profiles;
