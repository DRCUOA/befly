#!/usr/bin/env bash
#
# csv-to-doc.sh — Convert writing_blocks.csv into a Word .docx document.
#
# Pulls ONLY the `title` and `body` columns from the CSV and renders each row
# as a document section: title as a heading, body as flowing paragraphs, with
# each entry starting on its own page. Uses Python's stdlib `csv` parser
# (handles quoted fields, embedded commas and newlines), then pandoc to .docx.
#
# Usage:
#   scripts/csv-to-doc.sh INPUT.csv [OUTPUT.docx]
#
# If OUTPUT is omitted, it defaults to INPUT with a .docx extension.
#
# Examples:
#   scripts/csv-to-doc.sh writing_blocks.csv
#   scripts/csv-to-doc.sh writing_blocks.csv ~/Desktop/writing_blocks.docx

set -euo pipefail

# --- args ---------------------------------------------------------------------
if [[ $# -lt 1 || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '2,/^$/p'
  exit 1
fi

INPUT="$1"
OUTPUT="${2:-${INPUT%.*}.docx}"

# --- preflight ----------------------------------------------------------------
if [[ ! -f "$INPUT" ]]; then
  echo "Error: input file not found: $INPUT" >&2
  exit 1
fi
if ! command -v pandoc >/dev/null 2>&1; then
  echo "Error: pandoc is required but not installed (brew install pandoc)." >&2
  exit 1
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Error: python3 is required but not installed." >&2
  exit 1
fi

TITLE="$(basename "${INPUT%.*}")"
TMP_MD="$(mktemp -t csv2doc).md"
trap 'rm -f "$TMP_MD"' EXIT

# --- CSV (title, body only) -> Markdown ---------------------------------------
# Reads the header to locate the `title` and `body` columns by name (case-
# insensitive), then emits one section per row: title as a heading, body as
# paragraphs, with a page break between entries.
python3 - "$INPUT" "$TITLE" >"$TMP_MD" <<'PY'
import csv, sys

path, doctitle = sys.argv[1], sys.argv[2]

with open(path, newline="", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    fields = reader.fieldnames or []

    # Map requested columns to their actual header names (case-insensitive).
    lookup = {(name or "").strip().lower(): name for name in fields}
    try:
        title_col = lookup["title"]
        body_col = lookup["body"]
    except KeyError:
        sys.stderr.write(
            "Error: CSV must contain 'title' and 'body' columns. "
            f"Found: {fields}\n"
        )
        sys.exit(2)

    PAGE_BREAK = '\n```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n'

    n = 0
    for row in reader:
        title = (row.get(title_col) or "").strip()
        body = (row.get(body_col) or "").replace("\r\n", "\n").strip()
        if not title and not body:
            continue
        if n > 0:
            print(PAGE_BREAK)
        print(f"# {title or '(untitled)'}\n")
        # Blank lines already separate paragraphs in Markdown; pass body through.
        print(body if body else "_(no body)_")
        n += 1

    if n == 0:
        print(f"# {doctitle}\n\n_(no rows with title or body)_")
PY

# --- Markdown -> .docx --------------------------------------------------------
pandoc "$TMP_MD" -f markdown -t docx -o "$OUTPUT"

echo "Wrote $OUTPUT"
