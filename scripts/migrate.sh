#!/bin/sh
# Run SQL migrations

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../server"
MIGRATIONS_DIR="$SERVER_DIR/src/db/migrations"

# Load environment variables
if [ -f "$SCRIPT_DIR/../.env" ]; then
  export $(cat "$SCRIPT_DIR/../.env" | grep -v '^#' | xargs)
fi

DATABASE_URL="${DATABASE_URL:-postgres://user:pass@localhost:5432/writing}"

echo "Running migrations..."
SAFE_DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed -E 's#(://[^:]+):[^@]*@#\1:***@#')"
echo "Database: $SAFE_DATABASE_URL"

# Track applied migrations so releases are idempotent
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
SQL

# Run each migration file in order (once)
for migration in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$migration" ]; then
    filename="$(basename "$migration")"
    applied=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$filename' LIMIT 1;")

    if [ "$applied" = "1" ]; then
      echo "Skipping $filename (already applied)"
      continue
    fi

    echo "Running $filename..."
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('$filename');"
  fi
done

echo "Migrations completed!"
