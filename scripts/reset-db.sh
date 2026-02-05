#!/bin/bash
# Destructive local database reset
# WARNING: This will drop all tables!

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load environment variables
if [ -f "$SCRIPT_DIR/../.env" ]; then
  export $(cat "$SCRIPT_DIR/../.env" | grep -v '^#' | xargs)
fi

DATABASE_URL="${DATABASE_URL:-postgres://user:pass@localhost:5432/writing}"

echo "WARNING: This will drop all tables in the database!"
echo "Database: $DATABASE_URL"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

echo "Dropping all tables..."

psql "$DATABASE_URL" <<EOF
DROP TABLE IF EXISTS appreciations CASCADE;
DROP TABLE IF EXISTS writing_themes CASCADE;
DROP TABLE IF EXISTS themes CASCADE;
DROP TABLE IF EXISTS writing_blocks CASCADE;
DROP TABLE IF EXISTS users CASCADE;
EOF

echo "Database reset complete!"
echo "Run 'npm run migrate' to recreate tables."
