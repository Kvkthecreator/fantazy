# Database Access Guide

## Supabase Project Details

| Setting | Value |
|---------|-------|
| Project ID | `lfwhdzwbikyzalpbwfnd` |
| Region | `ap-northeast-1` (Tokyo) |
| Dashboard | https://supabase.com/dashboard/project/lfwhdzwbikyzalpbwfnd |
| SQL Editor | https://supabase.com/dashboard/project/lfwhdzwbikyzalpbwfnd/sql |

---

## Connection Methods

### 1. Session Pooler (Recommended for Apps)

IPv4 compatible, works with Render/serverless:

```
postgresql://postgres.lfwhdzwbikyzalpbwfnd:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
```

### 2. Transaction Pooler (For High Connection Count)

```
postgresql://postgres.lfwhdzwbikyzalpbwfnd:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
```

### 3. Direct Connection (IPv6 Only)

```
postgresql://postgres:[PASSWORD]@db.lfwhdzwbikyzalpbwfnd.supabase.co:5432/postgres
```

> **Note:** Direct connection is IPv6 only. Use pooler for IPv4 environments.

---

## Running Migrations via CLI

### Set up environment variable

```bash
export FANTAZY_DB_PASSWORD='your-database-password'
```

Find password at: https://supabase.com/dashboard/project/lfwhdzwbikyzalpbwfnd/settings/database

### Run a migration

```bash
PGPASSWORD="$FANTAZY_DB_PASSWORD" psql \
  "postgresql://postgres.lfwhdzwbikyzalpbwfnd@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" \
  -f supabase/migrations/008_image_storage.sql
```

### Quick SQL command

```bash
PGPASSWORD="$FANTAZY_DB_PASSWORD" psql \
  "postgresql://postgres.lfwhdzwbikyzalpbwfnd@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres" \
  -c "SELECT NOW()"
```

---

## Running Migrations via SQL Editor (Alternative)

If CLI access fails (password issues, network restrictions):

1. Go to https://supabase.com/dashboard/project/lfwhdzwbikyzalpbwfnd/sql
2. Click "New query"
3. Paste contents of migration file
4. Click "Run"

---

## Environment Variables

### For API (Render)

```
DATABASE_URL=postgresql://postgres.lfwhdzwbikyzalpbwfnd:[PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://lfwhdzwbikyzalpbwfnd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[from Supabase dashboard]
```

### For Local Scripts

```bash
export FANTAZY_DB_PASSWORD='[from Supabase dashboard]'
```

---

## Troubleshooting

### "Tenant or user not found"

- Check password is correct
- Ensure using `.lfwhdzwbikyzalpbwfnd` project reference in username

### "could not translate host name"

- Direct connection requires IPv6
- Use pooler URL instead (has IPv4)

### Timeout

- Supabase may pause inactive databases on free tier
- Access dashboard to wake it up
