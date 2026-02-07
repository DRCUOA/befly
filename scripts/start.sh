#!/bin/sh
set -e

# Heroku one-off dynos append command args to the web command.
# If args are present, run them directly (e.g. `sh scripts/migrate.sh`).
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Standard web boot path: run idempotent migrations first, then start app.
sh scripts/migrate.sh

exec node server/dist/index.js
