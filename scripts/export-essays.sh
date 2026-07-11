#!/usr/bin/env bash
#
# export-essays.sh — Export writing_blocks from Postgres into the befly
# essay-export JSON format (matches essays-export-subset-*.json).
#
# Output shape:
#   { version, exportedAt, type, scopeLabel, themes[], essays[], users[] }
# Each essay carries: id, userId, title, body, themeIds[], visibility,
# coverImageUrl, coverImagePosition, createdAt, updatedAt.
#
# Usage:
#   scripts/export-essays.sh [--user UUID] [--email ADDR] [-o OUTPUT.json]
#
#   --user UUID    Only export essays owned by this user id.
#   --email ADDR   Only export essays owned by the user with this email.
#   -o FILE        Write to FILE (default: essays-export-<UTC timestamp>.json).
#
# With no filter, ALL writing blocks are exported. When the result contains a
# single owner, scopeLabel reads "N essay(s) for user <uuid>" (sample-style).
#
# DB connection (override via env): PGUSER (default Rich), PGDATABASE (default writing).
#
# Examples:
#   scripts/export-essays.sh
#   scripts/export-essays.sh --email richarddclark2@gmail.com -o mine.json
#   scripts/export-essays.sh --user 77284031-7bbf-4157-b6ff-5a88609cfee3

set -euo pipefail

UID_ARG=""
EMAIL_ARG=""
OUTPUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --user)  UID_ARG="${2:-}"; shift 2 ;;
    --email) EMAIL_ARG="${2:-}"; shift 2 ;;
    -o)      OUTPUT="${2:-}"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '2,/^$/p'; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

DB="${PGDATABASE:-writing}"
DBUSER="${PGUSER:-Rich}"

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql not found." >&2; exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 not found (used for pretty-printing)." >&2; exit 1
fi

if [[ -z "$OUTPUT" ]]; then
  TS="$(date -u +%Y%m%dT%H%M%SZ)"
  OUTPUT="essays-export-${TS}.json"
fi

# Build the entire document server-side. json_build_object preserves key order;
# timestamps are rendered as UTC ISO-8601 with milliseconds and a trailing Z.
RAW="$(psql -X -A -t -q -v ON_ERROR_STOP=1 \
  -v uid="$UID_ARG" -v email="$EMAIL_ARG" \
  -U "$DBUSER" -d "$DB" <<'SQL'
WITH wb AS (
  SELECT *
  FROM writing_blocks
  WHERE (NULLIF(:'uid','')   IS NULL OR user_id = NULLIF(:'uid','')::uuid)
    AND (NULLIF(:'email','') IS NULL OR user_id = (SELECT id FROM users WHERE email = NULLIF(:'email','')))
),
essay_json AS (
  SELECT
    w.created_at AS ord,
    json_build_object(
      'id',                 w.id,
      'userId',             w.user_id,
      'title',              w.title,
      'body',               w.body,
      'themeIds',           COALESCE(
                              (SELECT json_agg(wt.theme_id ORDER BY wt.theme_id)
                                 FROM writing_themes wt WHERE wt.writing_id = w.id),
                              '[]'::json),
      'visibility',         w.visibility,
      'coverImageUrl',      w.cover_image_url,
      'coverImagePosition', w.cover_image_position,
      'createdAt',          to_char(w.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updatedAt',          CASE WHEN w.updated_at IS NULL THEN NULL
                                 ELSE to_char(w.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
    ) AS j
  FROM wb w
)
SELECT json_build_object(
  'version',     '1.0',
  'exportedAt',  to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'type',        'essays',
  'scopeLabel',  (SELECT count(*) FROM wb)::text || ' essay(s)' ||
                 CASE WHEN (SELECT count(DISTINCT user_id) FROM wb) = 1
                      THEN ' for user ' || (SELECT DISTINCT user_id FROM wb)::text
                      ELSE '' END,
  'themes',      COALESCE((
                   SELECT json_agg(json_build_object(
                            'id', t.id, 'name', t.name, 'slug', t.slug, 'visibility', t.visibility)
                          ORDER BY t.name)
                     FROM themes t
                    WHERE t.id IN (SELECT DISTINCT wt.theme_id
                                     FROM writing_themes wt
                                    WHERE wt.writing_id IN (SELECT id FROM wb))
                 ), '[]'::json),
  'essays',      COALESCE((SELECT json_agg(j ORDER BY ord) FROM essay_json), '[]'::json),
  'users',       COALESCE((
                   SELECT json_agg(json_build_object(
                            'id', u.id, 'email', u.email, 'displayName', u.display_name)
                          ORDER BY u.email)
                     FROM users u
                    WHERE u.id IN (SELECT DISTINCT user_id FROM wb)
                 ), '[]'::json)
);
SQL
)"

# Pretty-print (2-space indent) to match the sample export, preserving key order.
printf '%s' "$RAW" | python3 -m json.tool --indent 2 --no-ensure-ascii > "$OUTPUT"

COUNT="$(python3 -c "import json,sys;print(len(json.load(open(sys.argv[1]))['essays']))" "$OUTPUT")"
echo "Wrote $OUTPUT ($COUNT essay(s))"
