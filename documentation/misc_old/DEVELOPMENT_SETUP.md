# Development Environment Setup Guide

Complete step-by-step instructions for setting up the development environment.

## Prerequisites

Before starting, ensure you have the following installed:

1. **Node.js** (v18.0.0 or higher)
   ```bash
   node --version  # Should show v18.x.x or higher
   ```

2. **PostgreSQL** (v12 or higher)
   ```bash
   psql --version  # Should show PostgreSQL 12.x or higher
   ```

3. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

4. **Git** (for cloning the repository)
   ```bash
   git --version
   ```

## Step 1: Clone and Navigate to Project

```bash
# If cloning from repository
git clone <repository-url>
cd befly

# Or if already in the project directory
cd /Volumes/SecureData/c26/active/befly
```

## Step 2: Install Dependencies

### Root Level Dependencies
```bash
npm install
```

This installs workspace dependencies for the monorepo structure (client, server, shared).

### Server Dependencies
```bash
cd server
npm install bcrypt jsonwebtoken express-rate-limit cookie-parser
npm install --save-dev @types/bcrypt @types/jsonwebtoken @types/cookie-parser
cd ..
```

**Note:** If npm is not available in your shell, you may need to:
- Use the full path to npm: `/usr/local/bin/npm` or `/opt/homebrew/bin/npm`
- Or ensure Node.js/npm is in your PATH

## Step 3: Set Up PostgreSQL Database

### Create Database
```bash
# Connect to PostgreSQL
psql postgres

# In psql prompt, create database and user
CREATE DATABASE writing;
CREATE USER writing_user WITH PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE writing TO writing_user;

# Exit psql
\q
```

### Alternative: Use Existing PostgreSQL
If you already have PostgreSQL running, you can use an existing database:
```bash
# Test connection
psql -U your_username -d your_database -c "SELECT version();"
```

## Step 4: Configure Environment Variables

### Copy Environment Template
```bash
cp .env.example .env
```

### Edit `.env` File
Open `.env` and configure the following:

```env
NODE_ENV=development
PORT=3005
DATABASE_URL=postgres://writing_user:your_password@localhost:5432/writing
CORS_ORIGIN=http://localhost:5178
JWT_SECRET=your-secret-key-change-in-production-use-strong-random-secret
JWT_EXPIRES_IN=7d
```

**Important:**
- Replace `your_password` with your actual PostgreSQL password
- Replace `writing_user` with your PostgreSQL username if different
- Replace `your-secret-key-change-in-production-use-strong-random-secret` with a strong random string
  - You can generate one: `openssl rand -base64 32`
- Ensure `DATABASE_URL` matches your PostgreSQL setup
- `CORS_ORIGIN` should match your frontend dev server URL (default: http://localhost:5178)

### Example `.env` File
```env
NODE_ENV=development
PORT=3005
DATABASE_URL=postgres://Rich:pass@localhost:5432/writing
CORS_ORIGIN=http://localhost:5178
JWT_SECRET=dev-secret-key-change-in-production-abc123xyz789
JWT_EXPIRES_IN=7d
```

## Step 5: Run Database Migrations

```bash
npm run migrate
```

This will:
- Create all required tables (users, writing_blocks, themes, writing_themes, appreciations)
- Add indexes and constraints
- Set up foreign keys

**Expected Output:**
```
Running migrations...
Database: postgres://...
Running 001_init.sql...
Running 002_themes.sql...
Running 003_appreciations.sql...
Running 004_auth_and_visibility.sql...
Running 005_add_roles.sql...
Migrations completed!
```

## Step 6: Seed Development Data

```bash
npm run seed
```

This will:
- Create a demo user (demo@example.com / password: demo123)
- Create sample themes
- Create a sample writing block
- Generate bcrypt password hash at runtime

**Expected Output:**
```
Seeding database with generated password hash...
Database: postgres://...
Password: demo123
Generated hash: $2b$12$...
Seed data inserted successfully!
```

## Step 7: Start Development Servers

### Option A: Start Both Servers Together (Recommended)
```bash
npm run dev
```

This starts both client and server concurrently:
- **Server:** http://localhost:3005
- **Client:** http://localhost:5178

### Option B: Start Servers Separately

**Terminal 1 - Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Client:**
```bash
cd client
npm run dev
```

## Step 8: Verify Installation

### Check Server Health
```bash
curl http://localhost:3005/api/health
```

Expected response:
```json
{"status":"ok"}
```

### Check Frontend
Open browser: http://localhost:5178

You should see:
- Home page with "Recent Writing"
- Navigation bar
- Sign Up / Sign In buttons (if not authenticated)

## Step 9: Test Authentication

### Sign Up a New User
1. Click "Sign Up" in navigation
2. Fill in:
   - Email: `test@example.com`
   - Display Name: `Test User`
   - Password: `test1234` (at least 8 characters)
   - Confirm Password: `test1234`
3. Click "Sign Up"
4. You should be redirected to home page and see your name in navigation

### Sign In with Demo User
1. Click "Sign In"
2. Use credentials:
   - Email: `demo@example.com`
   - Password: `demo123`
3. Click "Sign In"
4. You should see "Demo User" in navigation

### Test Protected Routes
1. While signed in, click "Write"
2. Create a writing block with visibility options
3. View it on the home page

## Troubleshooting

### Database Connection Issues

**Error: "connection refused"**
- Ensure PostgreSQL is running: `pg_isready` or `brew services list` (macOS)
- Check DATABASE_URL in `.env` matches your PostgreSQL setup
- Verify PostgreSQL is listening on port 5432: `lsof -i :5432`

**Error: "password authentication failed"**
- Verify username and password in DATABASE_URL
- Check PostgreSQL user permissions: `psql -U postgres -c "\du"`

**Error: "database does not exist"**
- Create the database: `createdb writing` or use psql to create it

### Port Already in Use

**Error: "Port 3005 already in use"**
```bash
# Find process using port 3005
lsof -i :3005

# Kill the process (replace PID with actual process ID)
kill -9 <PID>

# Or change PORT in .env to a different port
```

**Error: "Port 5178 already in use"**
```bash
# Find and kill process
lsof -i :5178
kill -9 <PID>

# Or change client port in client/vite.config.ts
```

### Migration Errors

**Error: "relation already exists"**
- Tables may already exist from previous setup
- Reset database: `npm run reset-db` (WARNING: deletes all data)
- Then run migrations again: `npm run migrate`

**Error: "permission denied"**
- Ensure database user has proper permissions
- Grant privileges: `GRANT ALL PRIVILEGES ON DATABASE writing TO writing_user;`

### npm Command Not Found

**Error: "command not found: npm"**
- Node.js may not be in PATH
- Use full path: `/usr/local/bin/npm` or `/opt/homebrew/bin/npm`
- Or install Node.js via Homebrew: `brew install node`

### TypeScript Compilation Errors

**Error: "Cannot find module '@shared/...'"**
- Ensure workspace dependencies are installed: `npm install` at root
- Check that `shared` package exists and has proper exports

### CSRF Token Errors

**Error: "CSRF token missing"**
- Ensure API client includes CSRF token in headers
- Check that cookies are being sent (browser DevTools > Network > Request Headers)
- Verify CORS_ORIGIN matches frontend URL exactly

## Development Workflow

### Making Changes

1. **Backend Changes:**
   - Edit files in `server/src/`
   - Server auto-reloads with nodemon
   - Check server logs in terminal

2. **Frontend Changes:**
   - Edit files in `client/src/`
   - Vite hot-reloads automatically
   - Check browser console for errors

3. **Database Changes:**
   - Create new migration file in `server/src/db/migrations/`
   - Run: `npm run migrate`
   - Update seed data if needed: `server/src/db/seed-with-hash.ts`

### Testing Changes

1. **Test API Endpoints:**
   ```bash
   # Health check
   curl http://localhost:3005/api/health
   
   # Get writings (public)
   curl http://localhost:3005/api/writing
   
   # Sign up
   curl -X POST http://localhost:3005/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test1234","displayName":"Test"}'
   ```

2. **Test Frontend:**
   - Open browser DevTools (F12)
   - Check Console for errors
   - Check Network tab for API calls
   - Test authentication flow

### Database Reset (Development Only)

**WARNING: This deletes all data!**

```bash
npm run reset-db
npm run migrate
npm run seed
```

## Project Structure

```
befly/
├── client/              # Vue 3 frontend
│   ├── src/
│   │   ├── pages/      # Page components
│   │   ├── components/ # Reusable components
│   │   ├── stores/     # State management (auth)
│   │   ├── api/        # API client
│   │   └── router/     # Vue Router
│   └── package.json
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/     # API routes
│   │   ├── controllers/# Request handlers
│   │   ├── services/   # Business logic
│   │   ├── repositories/# Data access
│   │   ├── middleware/ # Express middleware
│   │   ├── db/
│   │   │   └── migrations/ # SQL migrations
│   │   └── config/     # Configuration
│   └── package.json
├── shared/              # Shared TypeScript types
│   ├── WritingBlock.ts
│   ├── Theme.ts
│   ├── User.ts
│   └── ApiResponses.ts
├── scripts/             # Development scripts
│   ├── dev.sh          # Start dev servers
│   ├── migrate.sh      # Run migrations
│   ├── seed.sh         # Seed database
│   └── reset-db.sh     # Reset database
├── .env                 # Environment variables (not in git)
├── .env.example         # Environment template
└── package.json         # Root package.json (workspaces)
```

## Next Steps

Once development environment is set up:

1. **Explore the Application:**
   - Sign up and create writing blocks
   - Test visibility settings (private/shared/public)
   - Create themes and associate them with writing
   - Test appreciation feature

2. **Review Code:**
   - Check `server/src/` for backend implementation
   - Check `client/src/` for frontend implementation
   - Review `shared/` for type definitions

3. **Read Documentation:**
   - `documentation/README.md` - Architecture overview
   - `documentation/requirements.json` - Core requirements
   - `documentation/requirements_addendum_users.json` - Multi-user requirements
   - `IMPLEMENTATION_COMPLETE.md` - Implementation summary

4. **Development Tips:**
   - Use browser DevTools to inspect API calls
   - Check server logs for backend errors
   - Use PostgreSQL client to inspect database directly
   - Test with multiple users to verify data isolation

## Support

If you encounter issues:

1. Check error messages in terminal and browser console
2. Verify all environment variables are set correctly
3. Ensure PostgreSQL is running and accessible
4. Check that all dependencies are installed
5. Review troubleshooting section above

For detailed architecture information, see `documentation/README.md`.
