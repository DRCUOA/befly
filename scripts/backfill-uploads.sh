#!/bin/sh
# One-time backfill: import existing filesystem images into PostgreSQL.
# Run on the current dyno BEFORE the next restart wipes ephemeral files.
#
# Usage (Heroku):
#   heroku run "sh scripts/backfill-uploads.sh" -a befly
#
# Usage (local):
#   sh scripts/backfill-uploads.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../server"
COVER_DIR="$SERVER_DIR/uploads/cover"

if [ -f "$SCRIPT_DIR/../.env" ]; then
  export $(cat "$SCRIPT_DIR/../.env" | grep -v '^#' | xargs)
fi

DATABASE_URL="${DATABASE_URL:-postgres://user:pass@localhost:5432/writing}"

if [ ! -d "$COVER_DIR" ]; then
  echo "No cover directory found at $COVER_DIR — nothing to backfill."
  exit 0
fi

count=0
for img in "$COVER_DIR"/*.jpg "$COVER_DIR"/*.jpeg "$COVER_DIR"/*.png "$COVER_DIR"/*.gif "$COVER_DIR"/*.webp; do
  [ -f "$img" ] || continue
  filename="$(basename "$img")"

  exists=$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM uploaded_files WHERE filename = '$filename' LIMIT 1;" 2>/dev/null || echo "")
  if [ "$exists" = "1" ]; then
    echo "Skipping $filename (already in DB)"
    continue
  fi

  ext="${filename##*.}"
  case "$ext" in
    jpg|jpeg) ctype="image/jpeg" ;;
    png)      ctype="image/png" ;;
    gif)      ctype="image/gif" ;;
    webp)     ctype="image/webp" ;;
    *)        ctype="application/octet-stream" ;;
  esac

  size=$(wc -c < "$img" | tr -d ' ')

  echo "Importing $filename ($size bytes, $ctype)..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
    INSERT INTO uploaded_files (filename, content_type, data, size_bytes)
    VALUES ('$filename', '$ctype', lo_get(lo_import('$img')), $size)
    ON CONFLICT (filename) DO NOTHING;
  " 2>/dev/null || {
    # lo_import may not work in all environments; fall back to hex encoding
    hex=$(xxd -p "$img" | tr -d '\n')
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
      INSERT INTO uploaded_files (filename, content_type, data, size_bytes)
      VALUES ('$filename', '$ctype', decode('$hex', 'hex'), $size)
      ON CONFLICT (filename) DO NOTHING;
    "
  }
  count=$((count + 1))
done

echo "Backfill complete: $count image(s) imported."
