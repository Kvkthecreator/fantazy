#!/usr/bin/env bash
# =============================================================================
# Fantazy Database Schema Dump & SQL Execution Script
# =============================================================================
# This script connects to the Fantazy Supabase database for schema operations
# and direct SQL execution.
#
# SUPABASE PROJECT: lfwhdzwbikyzalpbwfnd
# REGION: ap-northeast-1 (Tokyo)
# DASHBOARD: https://supabase.com/dashboard/project/lfwhdzwbikyzalpbwfnd
#
# =============================================================================
# CONNECTION OPTIONS
# =============================================================================
# Session Pooler (IPv4 compatible, for Render):
#   Host: aws-1-ap-northeast-1.pooler.supabase.com
#   Port: 5432 (session mode)
#
# Direct Connection (IPv6 only):
#   Host: db.lfwhdzwbikyzalpbwfnd.supabase.co
#   Port: 5432
#
# =============================================================================
# USAGE
# =============================================================================
#
# 1. Set your database password:
#    export FANTAZY_DB_PASSWORD="your-password-here"
#
# 2. Run commands:
#    ./scripts/dump_schema.sh schema     # Dump schema to docs/SCHEMA_SNAPSHOT.sql
#    ./scripts/dump_schema.sh tables     # List all tables
#    ./scripts/dump_schema.sh counts     # Show table row counts
#    ./scripts/dump_schema.sh sql "SELECT * FROM users LIMIT 5"  # Execute SQL
#    ./scripts/dump_schema.sh migrate path/to/migration.sql      # Run migration
#    ./scripts/dump_schema.sh psql       # Open interactive psql session
#
# =============================================================================

set -euo pipefail

# Configuration
SUPABASE_PROJECT="lfwhdzwbikyzalpbwfnd"
SUPABASE_REGION="ap-northeast-1"
POOLER_HOST="aws-1-${SUPABASE_REGION}.pooler.supabase.com"
DIRECT_HOST="db.${SUPABASE_PROJECT}.supabase.co"

# Check if password is set
if [ -z "${FANTAZY_DB_PASSWORD:-}" ]; then
    echo "Error: FANTAZY_DB_PASSWORD environment variable not set"
    echo ""
    echo "Set it with:"
    echo "  export FANTAZY_DB_PASSWORD='your-password-here'"
    echo ""
    echo "Find your password at:"
    echo "  https://supabase.com/dashboard/project/${SUPABASE_PROJECT}/settings/database"
    exit 1
fi

# Connection strings
# Session pooler (IPv4 compatible - use this for most operations)
POOLER_URL="postgresql://postgres.${SUPABASE_PROJECT}:${FANTAZY_DB_PASSWORD}@${POOLER_HOST}:5432/postgres?sslmode=require"

# Direct connection (IPv6 - use for pg_dump which needs direct access)
DIRECT_URL="postgresql://postgres:${FANTAZY_DB_PASSWORD}@${DIRECT_HOST}:5432/postgres?sslmode=require"

# Default to pooler for most operations
CONN_URL="$POOLER_URL"

# Helper function for psql commands
run_psql() {
    PGPASSWORD="$FANTAZY_DB_PASSWORD" psql "$CONN_URL" "$@"
}

# Helper function for pg_dump (uses direct connection)
run_pg_dump() {
    PGPASSWORD="$FANTAZY_DB_PASSWORD" pg_dump "$DIRECT_URL" "$@"
}

# Commands
case "${1:-help}" in
    schema)
        echo "Dumping schema to docs/SCHEMA_SNAPSHOT.sql..."
        mkdir -p docs

        # Try pooler first, fall back to direct if needed
        if PGPASSWORD="$FANTAZY_DB_PASSWORD" pg_dump \
            --schema=public \
            --schema-only \
            --no-owner \
            --no-privileges \
            --no-comments \
            "$POOLER_URL" \
            2>/dev/null \
            | grep -v -E '^(--|SET|SELECT pg_catalog|COMMENT ON EXTENSION|CREATE EXTENSION|ALTER TABLE ONLY public\..* OWNER TO)' \
            | sed '/^$/d' \
            > docs/SCHEMA_SNAPSHOT.sql; then
            echo "Schema dumped successfully (via pooler)"
        else
            echo "Pooler failed, trying direct connection..."
            PGPASSWORD="$FANTAZY_DB_PASSWORD" pg_dump \
                --schema=public \
                --schema-only \
                --no-owner \
                --no-privileges \
                --no-comments \
                "$DIRECT_URL" \
                | grep -v -E '^(--|SET|SELECT pg_catalog|COMMENT ON EXTENSION|CREATE EXTENSION|ALTER TABLE ONLY public\..* OWNER TO)' \
                | sed '/^$/d' \
                > docs/SCHEMA_SNAPSHOT.sql
            echo "Schema dumped successfully (via direct)"
        fi
        ;;

    tables)
        echo "=== Tables in public schema ==="
        run_psql -c "
SELECT table_name,
       CASE WHEN table_type = 'BASE TABLE' THEN 'table' ELSE 'view' END as type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_type, table_name;
"
        ;;

    counts)
        echo "=== Table row counts ==="
        run_psql -c "
SELECT relname as table_name,
       n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
"
        ;;

    describe|desc)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 describe <table_name>"
            exit 1
        fi
        echo "=== Structure of $2 ==="
        run_psql -c "\d $2"
        ;;

    sql)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 sql \"SELECT * FROM table LIMIT 10\""
            exit 1
        fi
        run_psql -c "$2"
        ;;

    migrate)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 migrate path/to/migration.sql"
            exit 1
        fi
        if [ ! -f "$2" ]; then
            echo "Error: Migration file not found: $2"
            exit 1
        fi
        echo "Running migration: $2"
        run_psql -f "$2"
        echo "Migration completed."
        ;;

    psql)
        echo "Opening interactive psql session..."
        echo "Connected to: ${SUPABASE_PROJECT} (${SUPABASE_REGION})"
        run_psql
        ;;

    test)
        echo "Testing database connection..."
        if run_psql -c "SELECT 1 as connection_test;" > /dev/null 2>&1; then
            echo "Connection successful!"
            run_psql -c "SELECT current_database(), current_user, version();"
        else
            echo "Connection failed!"
            exit 1
        fi
        ;;

    help|*)
        echo "Fantazy Database CLI"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  schema              Dump schema to docs/SCHEMA_SNAPSHOT.sql"
        echo "  tables              List all tables in public schema"
        echo "  counts              Show row counts for all tables"
        echo "  describe <table>    Show structure of a table"
        echo "  sql \"<query>\"       Execute a SQL query"
        echo "  migrate <file>      Run a migration SQL file"
        echo "  psql                Open interactive psql session"
        echo "  test                Test database connection"
        echo "  help                Show this help"
        echo ""
        echo "Environment:"
        echo "  FANTAZY_DB_PASSWORD  Required. Your Supabase database password."
        echo ""
        echo "Examples:"
        echo "  $0 sql \"SELECT * FROM users LIMIT 5\""
        echo "  $0 migrate supabase/migrations/001_initial.sql"
        echo "  $0 describe characters"
        ;;
esac
