#!/usr/bin/env bash
# Assemble a GitHub Pages-ready site from porfolio-page/.
# Rewrites parent-relative icon/docs links so they resolve at the site root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$ROOT/_site"
REPO="${GITHUB_REPOSITORY:-thaihai-swe/summarizer-extension}"
DOCS_BASE="https://github.com/${REPO}/blob/main/docs/"

rm -rf "$SITE"
mkdir -p "$SITE/icons"

cp "$ROOT/porfolio-page/index.html" "$SITE/index.html"
cp "$ROOT/porfolio-page/common.css" "$SITE/common.css"
cp "$ROOT/icons/"icon-*.png "$SITE/icons/"
# Prevent Jekyll from ignoring files that start with underscore.
touch "$SITE/.nojekyll"

python3 - "$SITE/index.html" "$DOCS_BASE" <<'PY'
import sys
from pathlib import Path

html_path = Path(sys.argv[1])
docs_base = sys.argv[2]
html = html_path.read_text(encoding="utf-8")
html = html.replace("../icons/", "icons/")
html = html.replace("../docs/", docs_base)
html_path.write_text(html, encoding="utf-8")
PY

echo "Prepared GitHub Pages site at $SITE"
echo "Docs links point at $DOCS_BASE"
