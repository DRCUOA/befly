#!/bin/bash
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
echo "Database: $DATABASE_URL"

# Run each migration file in order
for migration in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$migration" ]; then
    echo "Running $(basename "$migration")..."
    psql "$DATABASE_URL" -f "$migration"
  fi
done

echo "Migrations completed!"
