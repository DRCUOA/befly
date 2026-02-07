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
```

Optional hardening values:

```bash
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

Use one-off dynos (if needed):

```bash
heroku run "npm run migrate" -a befly
heroku run "npm run seed" -a befly
```

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

- Ensure `CORS_ORIGIN` matches your frontend URL exactly.
- Confirm `/api/health` returns `{"status":"ok"}`.
- Set Heroku stack to container deployment workflow and keep `heroku.yml` in repo.
- Scale web dyno:

```bash
heroku ps:scale web=1 -a befly
```

## 8) Rollback

```bash
heroku releases -a befly
heroku releases:rollback v<release-number> -a befly
```
