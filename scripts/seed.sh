#!/bin/bash
# Seed development data

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../server"
SEED_FILE="$SERVER_DIR/src/db/seed.sql"

# Load environment variables
if [ -f "$SCRIPT_DIR/../.env" ]; then
  export $(cat "$SCRIPT_DIR/../.env" | grep -v '^#' | xargs)
fi

DATABASE_URL="${DATABASE_URL:-postgres://user:pass@localhost:5432/writing}"

echo "Seeding database..."
echo "Database: $DATABASE_URL"

psql "$DATABASE_URL" -f "$SEED_FILE"

echo "Seed data inserted!"
