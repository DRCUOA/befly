# Server

Express + TypeScript backend for the writing platform.

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

Runs on port 3005.

## Build

```bash
npm run build
npm start
```

## Type Checking

```bash
npm run type-check
```

## Database Migrations

Run migrations using the scripts in the root `scripts/` directory:

```bash
npm run migrate
```

## Configuration

- **Rate limits**: General API 1000 req/15 min per IP; auth endpoints 100 req/15 min
- **Image upload**: Max 10MB (JPEG, PNG, GIF, WebP)

## Architecture

- **Routes** → **Controllers** → **Services** → **Repositories** → **PostgreSQL**
- Explicit, inspectable, debuggable
- No ORM magic - raw SQL queries
- Stateless design
