# Quick Start Guide

Fast setup for development environment.

## Prerequisites Check

```bash
node --version   # Need v18+
psql --version   # Need PostgreSQL
npm --version    # Comes with Node.js
```

## Setup (5 minutes)

```bash
# 1. Install dependencies
npm install
cd server && npm install bcrypt jsonwebtoken express-rate-limit cookie-parser && npm install --save-dev @types/bcrypt @types/jsonwebtoken @types/cookie-parser && cd ..

# 2. Set up environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Create database (if needed)
createdb writing
# Or: psql -c "CREATE DATABASE writing;"

# 4. Run migrations
npm run migrate

# 5. Seed data
npm run seed

# 6. Start development
npm run dev
```

## Access

- **Frontend:** http://localhost:5178
- **Backend API:** http://localhost:3005
- **Health Check:** http://localhost:3005/api/health

## Demo Credentials

- **Email:** demo@example.com
- **Password:** demo123

## Common Commands

```bash
npm run dev        # Start both client and server
npm run migrate    # Run database migrations
npm run seed       # Seed development data
npm run reset-db   # Reset database (WARNING: deletes all data)
```

## Troubleshooting

**Database connection error?**
- Check `.env` DATABASE_URL is correct
- Ensure PostgreSQL is running: `pg_isready`

**Port already in use?**
- Change PORT in `.env` (server)
- Or kill process: `lsof -i :3005` then `kill -9 <PID>`

**npm not found?**
- Use full path: `/usr/local/bin/npm` or `/opt/homebrew/bin/npm`
- Or install Node.js: `brew install node`

For detailed setup, see `DEVELOPMENT_SETUP.md`.
