# SQL Direct Execution Guide

This guide covers running SQL migrations and queries directly against the Clearinghouse Supabase database.

## Why Direct Execution?

Clearinghouse uses direct `psql` execution instead of Supabase CLI migrations for several reasons:

1. **IPv4 Compatibility**: Session pooler connections work without IPv6
2. **Simplicity**: No need for Supabase CLI installation or config
3. **Flexibility**: Easy to run ad-hoc queries and debug
4. **Visibility**: Clear feedback on what's being executed

## Connection Setup

### Finding Your Connection String

1. Go to Supabase Dashboard > Project Settings > Database
2. Find "Connection string" section
3. Select "Session pooler" mode (for IPv4 compatibility)
4. Copy the connection string

### Connection String Format

```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

Components:
- `PROJECT_REF`: Your Supabase project reference (e.g., `pgpdqbrxkmqbmcdygmad`)
- `PASSWORD`: Your database password (URL-encoded if special chars)
- `REGION`: AWS region (e.g., `ap-south-1`)

### URL Encoding Special Characters

If your password contains special characters, URL-encode them:

| Character | Encoded |
|-----------|---------|
| `!` | `%21` |
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |

Example: `0Pikachu!!@@##$$%%` becomes `0Pikachu%21%21%40%40%23%23%24%24%25%25`

### Setting Up Environment Variable

```bash
# Option 1: Export in shell
export PG_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"

# Option 2: Use .env file
# Add to .env:
DATABASE_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"

# Then source it:
source .env
export PG_URL="$DATABASE_URL"
```

## Running Migrations

### Migration Files

Migrations are located in `supabase/migrations/` and numbered sequentially:

```
00001_core_schema.sql      # Workspaces, memberships, catalogs
00002_rights_entities.sql  # Rights entities, schemas, reference assets
00003_governance.sql       # Proposals, governance rules
00004_licensing.sql        # License templates, grants, usage
00005_audit_trail.sql      # Timeline events, triggers
00006_seed_schemas.sql     # Initial IP type definitions
```

### Running All Migrations

```bash
# Set connection string
PG_URL="postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require"

# Run all migrations in order
for f in supabase/migrations/*.sql; do
  echo "=== Running $f ==="
  psql "$PG_URL" -f "$f"
  echo ""
done
```

### Running a Single Migration

```bash
psql "$PG_URL" -f supabase/migrations/00001_core_schema.sql
```

### Checking Migration Status

```bash
# List all tables
psql "$PG_URL" -c "\dt"

# List tables with row counts
psql "$PG_URL" -c "
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY relname;
"
```

## Querying the Database

### Interactive Session

```bash
psql "$PG_URL"

# Then run queries interactively:
postgres=> SELECT * FROM rights_schemas;
postgres=> \q  -- to exit
```

### One-off Queries

```bash
# Simple query
psql "$PG_URL" -c "SELECT id, display_name, category FROM rights_schemas"

# Formatted output
psql "$PG_URL" -c "SELECT * FROM rights_schemas" -x  # Expanded view

# CSV output
psql "$PG_URL" -c "COPY (SELECT * FROM rights_schemas) TO STDOUT WITH CSV HEADER"
```

### Common Queries

```sql
-- List all IP type schemas
SELECT id, display_name, category FROM rights_schemas;

-- Count entities by type
SELECT rights_type, COUNT(*)
FROM rights_entities
GROUP BY rights_type;

-- Recent timeline events
SELECT event_type, summary, created_at
FROM timeline_events
ORDER BY created_at DESC
LIMIT 20;

-- Pending proposals
SELECT p.id, p.proposal_type, p.status, re.title as entity_title
FROM proposals p
LEFT JOIN rights_entities re ON re.id = p.target_entity_id
WHERE p.status = 'pending';

-- Active licenses
SELECT lg.id, re.title, l.name as licensee, lg.status
FROM license_grants lg
JOIN rights_entities re ON re.id = lg.rights_entity_id
LEFT JOIN licensees l ON l.id = lg.licensee_id
WHERE lg.status = 'active';
```

## Troubleshooting

### Connection Issues

**Error: "could not translate host name"**
- Use session pooler URL (not transaction pooler)
- Ensure you're using the full hostname

**Error: "password authentication failed"**
- Check password is URL-encoded if it contains special characters
- Verify password in Supabase dashboard

**Error: "SSL SYSCALL error"**
- Add `?sslmode=require` to connection string
- Try `?sslmode=prefer` if issues persist

### Migration Issues

**Error: "relation already exists"**
- Migration was already run
- Safe to ignore if tables exist correctly

**Error: "permission denied"**
- Using anon key instead of service role
- Need direct database password, not API key

### Checking Table Structure

```bash
# Describe a table
psql "$PG_URL" -c "\d rights_entities"

# List columns
psql "$PG_URL" -c "
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'rights_entities'
ORDER BY ordinal_position;
"
```

## Best Practices

1. **Always backup before modifications**
   ```bash
   pg_dump "$PG_URL" > backup_$(date +%Y%m%d).sql
   ```

2. **Test migrations locally first** (if you have local Postgres)

3. **Run migrations in order** - they have dependencies

4. **Check for errors** - read psql output carefully

5. **Use transactions for manual changes**
   ```sql
   BEGIN;
   -- your changes
   COMMIT;  -- or ROLLBACK; if issues
   ```

## Quick Reference

```bash
# Connect interactively
psql "$PG_URL"

# Run SQL file
psql "$PG_URL" -f file.sql

# Run single command
psql "$PG_URL" -c "SELECT 1"

# List tables
psql "$PG_URL" -c "\dt"

# Describe table
psql "$PG_URL" -c "\d tablename"

# Show all IP schemas
psql "$PG_URL" -c "SELECT id, display_name FROM rights_schemas"
```
