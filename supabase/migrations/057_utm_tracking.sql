-- Add UTM tracking and attribution fields to users table
-- This allows us to track which campaigns/sources drive signups and activation

ALTER TABLE users
ADD COLUMN IF NOT EXISTS signup_source TEXT,
ADD COLUMN IF NOT EXISTS signup_campaign TEXT,
ADD COLUMN IF NOT EXISTS signup_medium TEXT,
ADD COLUMN IF NOT EXISTS signup_content TEXT,
ADD COLUMN IF NOT EXISTS signup_landing_page TEXT,
ADD COLUMN IF NOT EXISTS signup_referrer TEXT;

-- Create indexes for filtering in admin dashboard
CREATE INDEX IF NOT EXISTS idx_users_signup_source ON users(signup_source);
CREATE INDEX IF NOT EXISTS idx_users_signup_campaign ON users(signup_campaign);

-- Add comment for documentation
COMMENT ON COLUMN users.signup_source IS 'UTM source (e.g., reddit, tiktok, google)';
COMMENT ON COLUMN users.signup_campaign IS 'UTM campaign (e.g., oi-villainess-v2, manhwa-regressor)';
COMMENT ON COLUMN users.signup_medium IS 'UTM medium (e.g., cpc, organic, video)';
COMMENT ON COLUMN users.signup_content IS 'UTM content for A/B testing ad variants';
COMMENT ON COLUMN users.signup_landing_page IS 'First page user landed on (e.g., /series/villainess-survives)';
COMMENT ON COLUMN users.signup_referrer IS 'HTTP referrer or "direct" if none';
