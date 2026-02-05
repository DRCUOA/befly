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

## Architecture

- **Routes** → **Controllers** → **Services** → **Repositories** → **PostgreSQL**
- Explicit, inspectable, debuggable
- No ORM magic - raw SQL queries
- Stateless design
