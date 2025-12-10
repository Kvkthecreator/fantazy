#!/bin/bash
# =============================================================================
# Clearinghouse Database Schema Dump Script
# =============================================================================
# This script connects to the Clearinghouse Supabase database and dumps schema info.
#
# SUPABASE PROJECT: pgpdqbrxkmqbmcdygmad
# REGION: ap-south-1 (Mumbai)
# DASHBOARD: https://supabase.com/dashboard/project/pgpdqbrxkmqbmcdygmad
#
# =============================================================================
# CONNECTION (Transaction Pooler - used by Render)
# =============================================================================
# Host: aws-1-ap-south-1.pooler.supabase.com
# Port: 6543 (transaction pooler)
# Note: Does NOT support prepared statements, use pgbouncer=true or statement_cache_size=0
#
# =============================================================================
# USAGE
# =============================================================================
#
# 1. Set your database password:
#    export CLEARINGHOUSE_DB_PASSWORD="your-password-here"
#
# 2. Run the script:
#    ./docs/dump_schema.sh
#
# Or run psql commands directly:
#    PGPASSWORD="$CLEARINGHOUSE_DB_PASSWORD" psql \
#      "postgresql://postgres.pgpdqbrxkmqbmcdygmad@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require" \
#      -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
#
# =============================================================================

# Check if password is set
if [ -z "$CLEARINGHOUSE_DB_PASSWORD" ]; then
    echo "Error: CLEARINGHOUSE_DB_PASSWORD environment variable not set"
    echo ""
    echo "Set it with:"
    echo "  export CLEARINGHOUSE_DB_PASSWORD='your-password-here'"
    echo ""
    echo "Find your password at:"
    echo "  https://supabase.com/dashboard/project/pgpdqbrxkmqbmcdygmad/settings/database"
    exit 1
fi

# Connection string (transaction pooler - same as Render uses)
CONN_STRING="postgresql://postgres.pgpdqbrxkmqbmcdygmad:${CLEARINGHOUSE_DB_PASSWORD}@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require"

echo "=== Clearinghouse Database Schema ==="
echo ""

echo "--- Tables in public schema ---"
PGPASSWORD="$CLEARINGHOUSE_DB_PASSWORD" psql "$CONN_STRING" -c "
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
"

echo ""
echo "--- Table row counts ---"
PGPASSWORD="$CLEARINGHOUSE_DB_PASSWORD" psql "$CONN_STRING" -c "
SELECT
    schemaname,
    relname as table_name,
    n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
"

echo ""
echo "--- Clearinghouse core tables structure ---"
for table in workspaces workspace_memberships catalogs rights_schemas rights_entities entity_embeddings processing_jobs reference_assets proposals governance_rules licenses entity_timeline; do
    echo ""
    echo "=== $table ==="
    PGPASSWORD="$CLEARINGHOUSE_DB_PASSWORD" psql "$CONN_STRING" -c "\d $table" 2>/dev/null || echo "(table not found)"
done
