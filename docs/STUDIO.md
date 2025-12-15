# Studio (Internal-Only)

## Access control
- Gated by Supabase auth **and** email allowlist.
- Allowlist env: `STUDIO_ALLOWED_EMAILS` (comma-separated). Default/fallback currently includes `kvkthecreator@gmail.com` to keep prod access for the requester.
- Middleware + `/studio` layout both enforce the allowlist; non-allowed users are redirected.

## Adding an internal user
1) Add their email to `STUDIO_ALLOWED_EMAILS` in your env (no spaces, comma-separated).
2) Deploy/restart so middleware and server components pick up the env change.

## Run/test locally
```bash
cd web
npm install
npm run dev
```
- Sign in via Supabase auth with an allowlisted email.
- Visit `/studio` (landing) → `/studio/create` (wizard v0).
- Submit button currently logs the draft JSON to the browser console (no persistence yet).
