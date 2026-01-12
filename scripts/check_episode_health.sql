-- Episode 0 Health Check
-- Run this periodically to ensure Episode 0 quality
-- Generated: 2026-01-12

\echo '=== Episode 0 Health Check ===\n'

-- Check 1: Episode 0s without roles
\echo '1. Episode 0s WITHOUT roles:'
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ All Episode 0s have roles'
        ELSE '❌ Found ' || COUNT(*) || ' Episode 0s without roles'
    END as status
FROM episode_templates
WHERE episode_number = 0 AND role_id IS NULL;

SELECT
    s.slug,
    et.title,
    et.id
FROM episode_templates et
JOIN series s ON s.id = et.series_id
WHERE et.episode_number = 0 AND et.role_id IS NULL
ORDER BY s.slug;

\echo ''

-- Check 2: Active series without Episode 0
\echo '2. Active series WITHOUT Episode 0:'
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ All active series have Episode 0'
        ELSE '❌ Found ' || COUNT(*) || ' active series without Episode 0'
    END as status
FROM series s
WHERE s.status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM episode_templates et
    WHERE et.series_id = s.id AND et.episode_number = 0
);

SELECT s.slug, s.title, s.id
FROM series s
WHERE s.status = 'active'
AND NOT EXISTS (
    SELECT 1 FROM episode_templates et
    WHERE et.series_id = s.id AND et.episode_number = 0
)
ORDER BY s.slug;

\echo ''

-- Check 3: Episode 0s without starter prompts
\echo '3. Episode 0s WITHOUT starter prompts:'
SELECT
    CASE
        WHEN COUNT(*) = 0 THEN '✓ All Episode 0s have starter prompts'
        ELSE '⚠️  Found ' || COUNT(*) || ' Episode 0s without starter prompts'
    END as status
FROM episode_templates
WHERE episode_number = 0
AND (starter_prompts IS NULL OR array_length(starter_prompts, 1) = 0);

SELECT
    s.slug,
    et.title,
    et.id
FROM episode_templates et
JOIN series s ON s.id = et.series_id
WHERE et.episode_number = 0
AND (et.starter_prompts IS NULL OR array_length(et.starter_prompts, 1) = 0)
ORDER BY s.slug;

\echo ''
\echo '=== Summary Stats ==='

SELECT
    COUNT(*) FILTER (WHERE episode_number = 0) as "Total Episode 0s",
    COUNT(*) FILTER (WHERE episode_number = 0 AND role_id IS NOT NULL) as "With Roles",
    ROUND(100.0 * COUNT(*) FILTER (WHERE episode_number = 0 AND role_id IS NOT NULL) /
          NULLIF(COUNT(*) FILTER (WHERE episode_number = 0), 0), 1) as "Role Coverage %",
    COUNT(*) FILTER (WHERE episode_number = 0 AND starter_prompts IS NOT NULL
                    AND array_length(starter_prompts, 1) > 0) as "With Prompts",
    ROUND(100.0 * COUNT(*) FILTER (WHERE episode_number = 0 AND starter_prompts IS NOT NULL
                                  AND array_length(starter_prompts, 1) > 0) /
          NULLIF(COUNT(*) FILTER (WHERE episode_number = 0), 0), 1) as "Prompt Coverage %"
FROM episode_templates;
