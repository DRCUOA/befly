# Heroku Production Deployment (Docker + Config Vars)

This project can run as a single Heroku `web` dyno using Docker:
- Vue client is built and copied into `server/public`
- Express serves API routes and the built SPA from one container

## 1) Prerequisites

- Heroku CLI installed and authenticated
- Existing Heroku app linked to this repo (`befly`)
- Heroku Container Registry login

```bash
heroku container:login
```

## 2) Provision PostgreSQL (recommended)

You do **not** need to rent a separate PostgreSQL instance unless you have specific compliance/performance needs.
Use Heroku Postgres:

```bash
heroku addons:create heroku-postgresql:essential-0 -a befly
```

This automatically injects `DATABASE_URL` into config vars.

## 3) Set production config vars

Set required runtime values:

```bash
heroku config:set NODE_ENV=production -a befly
heroku config:set APP_NAME="Befly" -a befly
heroku config:set CORS_ORIGIN="https://<your-domain>" -a befly

# CRITICAL: Generate a strong JWT secret for authentication
# Generate with: openssl rand -base64 32
heroku config:set JWT_SECRET="<your-generated-secret>" -a befly
```

**Important:** Replace `<your-generated-secret>` with a strong random string. Generate one with:
```bash
openssl rand -base64 32
```

Optional values:

```bash
heroku config:set JWT_EXPIRES_IN="7d" -a befly  # Default: 7d
heroku config:set NPM_CONFIG_PRODUCTION=true -a befly
```

## 4) Deploy with Docker

From the repo root:

```bash
heroku container:push web -a befly
heroku container:release web -a befly
```

Check logs:

```bash
heroku logs --tail -a befly
```

## 5) Run database migrations/seeds

**Important:** Ensure `psql` and Node.js build tools are available in your container.

Use one-off dynos:

```bash
# For migrations (requires psql in container)
heroku run "bash scripts/migrate.sh" -a befly

# For seeding (requires tsx/npx in container) - only for development
heroku run "bash scripts/seed.sh" -a befly
```

**Note:** The migration scripts require:
- `psql` PostgreSQL client (should be available in Node.js Alpine images)
- `tsx` for TypeScript execution (available via `npx tsx`)

If bash scripts don't work, verify your Dockerfile includes necessary tools or use Node.js-based migration scripts instead.

## 6) TLS/Certificates and SSH keys on Heroku

- **HTTPS certificates**: managed by Heroku automatically for `*.herokuapp.com`.
- For a custom domain, add ACM-managed certs:

```bash
heroku certs:auto:enable -a befly
```

- **SSH keys/certs** are typically for Git/developer access, not app runtime secrets.
- For runtime secrets, use `heroku config:set ...` (config vars).

If you need outbound SSH from the app to a third-party service, store private keys in config vars and materialize them at runtime with strict permissions.

## 7) Operational checklist

### Pre-deployment validation

Before deploying, verify all required config vars are set:

```bash
heroku config -a befly
```

Required config vars:
- ✅ `NODE_ENV=production`
- ✅ `DATABASE_URL` (auto-set by Heroku Postgres)
- ✅ `PORT` (auto-set by Heroku)
- ✅ `APP_NAME`
- ✅ `CORS_ORIGIN` (must match your frontend URL exactly, include protocol: `https://`)
- ✅ `JWT_SECRET` (must be set and strong - verify it's not the default)

### Post-deployment verification

- ✅ Ensure `CORS_ORIGIN` matches your frontend URL exactly (include protocol: `https://`)
- ✅ **CRITICAL:** Verify `JWT_SECRET` is set and is a strong random string (not the default)
- ✅ Confirm `/api/health` returns `{"status":"ok"}`
- ✅ Test authentication endpoints:
  ```bash
  curl https://<your-app>.herokuapp.com/api/health
  ```
- ✅ Verify CSRF protection is working (check that cookies are set in browser)
- ✅ Test signup/signin flows end-to-end
- ✅ Set Heroku stack to container deployment workflow and keep `heroku.yml` in repo
- ✅ Scale web dyno:

```bash
heroku ps:scale web=1 -a befly
```

### Monitoring

Monitor logs for errors:

```bash
heroku logs --tail -a befly
```

Watch for:
- Database connection errors
- Authentication failures
- CSRF token errors
- Rate limiting triggers

## 8) Rollback

If deployment fails or issues are discovered:

```bash
# List recent releases
heroku releases -a befly

# Rollback to previous release
heroku releases:rollback v<release-number> -a befly
```

**Note:** Database migrations are not automatically rolled back. If you need to rollback database changes, you'll need to create and run a reverse migration script manually.

## 9) Custom Domain Setup (Optional)

If using a custom domain:

1. Add domain to Heroku:
```bash
heroku domains:add www.yourdomain.com -a befly
```

2. Enable automatic SSL certificates:
```bash
heroku certs:auto:enable -a befly
```

3. Update DNS records as shown by Heroku:
```bash
heroku domains -a befly
```

4. Update `CORS_ORIGIN` config var to match your custom domain:
```bash
heroku config:set CORS_ORIGIN="https://www.yourdomain.com" -a befly
```

## 10) Backup Strategy

Heroku Postgres automatically provides daily backups. To create manual backups:

```bash
# Create a manual backup
heroku pg:backups:capture -a befly

# List backups
heroku pg:backups -a befly

# Download a backup
heroku pg:backups:download <backup-id> -a befly
```

For production, consider upgrading to a plan with longer retention periods.
