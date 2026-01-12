-- Assign roles to remaining Episode 0s without roles
-- Generated: 2026-01-12

-- Death Flag: Deleted (otome_isekai) - Create "The Villainess" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Villainess', 'the-villainess', 'Character who must avoid death flags in an otome game world', 'survivor')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-villainess' LIMIT 1)
WHERE id = 'ed805700-d648-4d13-9770-ec60754e0cab';

-- Villainess Survives (otome_isekai) - Use same "The Villainess" role
UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-villainess' LIMIT 1)
WHERE id = '80a43b5c-c90d-4d5f-bb4e-988cce69bf90';

-- Regressor's Last Chance (fantasy_action) - Create "The Regressor" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Regressor', 'the-regressor', 'Character who has returned to the past to change fate', 'survivor')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-regressor' LIMIT 1)
WHERE id = 'c0150f7f-c446-4006-a12f-50a365ecd243';

-- Debate Partners (GL) - Create "The Debater" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Debater', 'the-debater', 'Competitive debate partner role', 'competitive')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-debater' LIMIT 1)
WHERE id = '4a5f2c27-4066-4b89-99ea-0004f8fd4837';

-- Duke's Third Son (historical) - Create "The Noble" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Noble', 'the-noble', 'Noble character in historical setting', 'mysterious_reserved')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-noble' LIMIT 1)
WHERE id = '1e72ae7f-08e0-4732-bbac-019d43d4275a';

-- Ink & Canvas (BL) - Create "The Artist" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Artist', 'the-artist', 'Creative artist character', 'mysterious_reserved')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-artist' LIMIT 1)
WHERE id = 'd7980e61-d528-49bf-a0f4-71945a176015';

-- Session Notes (psychological) - Create "The Therapist" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Therapist', 'the-therapist', 'Professional therapist character', 'warm_supportive')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-therapist' LIMIT 1)
WHERE id = '4f469a3e-34a4-45df-b356-7dd0f909533a';

-- Corner Cafe (cozy) - Create "The Regular" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Regular', 'the-regular', 'Regular customer at cozy cafe', 'warm_supportive')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-regular' LIMIT 1)
WHERE id = 'b940a49c-4bc6-44f9-9e1f-2fdbdd9f51a7';

-- Room 404 (romantic_tension) - Create "The Neighbor" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Neighbor', 'the-neighbor', 'Mysterious neighbor character', 'mysterious_reserved')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-neighbor' LIMIT 1)
WHERE id = '5031ee6a-8f61-4e90-a44a-23e636ecbe80';

-- The Arrangement (fake_dating) - Create "The Fake Partner" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Fake Partner', 'the-fake-partner', 'Character in fake dating arrangement', 'playful_teasing')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-fake-partner' LIMIT 1)
WHERE id = '6a4d515f-ceb0-4786-8dfb-727f882990e2';

-- Bitter Rivals (enemies_to_lovers) - Use existing "The Rival" role
UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-rival' LIMIT 1)
WHERE id = 'f1ee6160-6e23-45a9-955a-52a835b29f67';

-- Locked In (romantic_tension) - Create "The Stranger" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Stranger', 'the-stranger', 'Mysterious stranger in enclosed space', 'mysterious_reserved')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-stranger' LIMIT 1)
WHERE id = 'b146629f-6b41-49c3-b9bb-af2fbaa5c4d6';

-- The Last Message (mystery) - Create "The Contact" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Contact', 'the-contact', 'Mysterious contact in investigation', 'investigator')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-contact' LIMIT 1)
WHERE id = '4d863db2-b513-45a4-9e52-dbe5913b59c3';

-- Blackout (survival_thriller) - Create "The Survivor" role
INSERT INTO roles (name, slug, description, archetype)
VALUES ('The Survivor', 'the-survivor', 'Character in survival situation', 'survivor')
ON CONFLICT (slug) DO NOTHING;

UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-survivor' LIMIT 1)
WHERE id = '698e878f-27f9-4fc1-a145-0a6175ae5630';

-- The Blacksite (survival_thriller) - Use same "The Survivor" role
UPDATE episode_templates
SET role_id = (SELECT id FROM roles WHERE slug = 'the-survivor' LIMIT 1)
WHERE id = 'c5d7e499-cadb-499d-97fa-b7872f6968d1';

-- Verify all Episode 0s now have roles
SELECT
    s.slug,
    et.title as episode_title,
    r.name as role_name,
    CASE WHEN et.role_id IS NULL THEN 'MISSING ROLE' ELSE 'OK' END as status
FROM episode_templates et
JOIN series s ON s.id = et.series_id
LEFT JOIN roles r ON r.id = et.role_id
WHERE et.episode_number = 0
ORDER BY status DESC, s.slug;
