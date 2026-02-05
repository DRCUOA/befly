#!/bin/bash
# Seed development data
# Uses TypeScript seed script to generate password hash at runtime

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../server"
SEED_SCRIPT="$SERVER_DIR/src/db/seed-with-hash.ts"

# Load environment variables
if [ -f "$SCRIPT_DIR/../.env" ]; then
  export $(cat "$SCRIPT_DIR/../.env" | grep -v '^#' | xargs)
fi

cd "$SERVER_DIR"

echo "Seeding database with generated password hash..."
echo "Database: ${DATABASE_URL:-postgres://user:pass@localhost:5432/writing}"

# Use tsx to run TypeScript seed script
npx tsx "$SEED_SCRIPT"

echo "Seed data inserted!"
