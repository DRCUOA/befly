#!/bin/sh
# Extract user_activity_logs rows from Heroku run logs and emit JSON.
# Usage:
#   heroku logs --app befly --dyno run.1234 | sh scripts/clean-userlogs.sh

set -eu

TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_OUT"' EXIT INT TERM

awk '
  /app\[run\.[0-9]+\]:/ {
    sub(/^.*app\[run\.[0-9]+\]:[[:space:]]*/, "", $0)

    # Keep only psql table lines.
    if (index($0, "|") == 0) next
    if ($0 ~ /^\([0-9]+ rows?\)$/) next
    if ($0 ~ /^[[:space:]]*$/) next
    if ($0 ~ /^[-+[:space:]]+$/) next

    n = split($0, cols, /\|/)
    if (n < 5) next

    for (i = 1; i <= 5; i++) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", cols[i])
    }

    # Skip psql header row.
    if (cols[1] == "created_at" && cols[2] == "activity_type") next

    printf "%s\t%s\t%s\t%s\t%s\n", cols[1], cols[2], cols[3], cols[4], cols[5]
  }
' > "$TMP_OUT"

if [ ! -s "$TMP_OUT" ]; then
  printf '{\n  "userlogs": [],\n  "count": 0\n}\n'
  exit 0
fi

awk -F '\t' '
  function trim(s) {
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
    return s
  }

  function escape_json(s) {
    gsub(/\\/,"\\\\",s)
    gsub(/"/,"\\\"",s)
    gsub(/\t/,"\\t",s)
    gsub(/\r/,"\\r",s)
    gsub(/\n/,"\\n",s)
    return s
  }

  function looks_like_json(v) {
    v = trim(v)
    if (v == "null" || v == "true" || v == "false") return 1
    if (v ~ /^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/) return 1
    if (v ~ /^\{.*\}$/ || v ~ /^\[.*\]$/) return 1
    if (v ~ /^".*"$/) return 1
    return 0
  }

  BEGIN {
    count = 0
    print "{"
    print "  \"userlogs\": ["
  }

  {
    created_at = trim($1)
    activity_type = trim($2)
    action = trim($3)
    user_id = trim($4)
    details = trim($5)

    if (count > 0) printf(",\n")
    printf("    {")
    printf("\"created_at\":\"%s\",", escape_json(created_at))
    printf("\"activity_type\":\"%s\",", escape_json(activity_type))
    printf("\"action\":\"%s\",", escape_json(action))
    if (user_id == "" || user_id == "null") {
      printf("\"user_id\":null,")
    } else {
      printf("\"user_id\":\"%s\",", escape_json(user_id))
    }

    if (details == "" || details == "null") {
      printf("\"details\":null")
    } else if (looks_like_json(details)) {
      printf("\"details\":%s", details)
    } else {
      printf("\"details\":\"%s\"", escape_json(details))
    }
    printf("}")
    count++
  }

  END {
    printf("\n  ],\n")
    printf("  \"count\": %d\n", count)
    print "}"
  }
' "$TMP_OUT"
