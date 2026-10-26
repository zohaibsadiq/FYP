#!/usr/bin/env bash
# Renders the guides in docs/ to HTML and PDF in docs/build/.
# Needs Node (for marked) and Google Chrome.
#
#   bash docs/build-pdf.sh                 both guides
#   bash docs/build-pdf.sh team-guide      one of them
set -e
cd "$(dirname "$0")/.."

mkdir -p docs/build
HERE="$(pwd -W 2>/dev/null || pwd)"

build() {
  local name="$1" title="$2"
  npx --yes marked -i "docs/$name.md" -o "docs/build/$name.body.html"
  node -e '
const fs = require("fs");
const [name, title] = process.argv.slice(1);
const body = fs.readFileSync(`docs/build/${name}.body.html`, "utf8");
const css = fs.readFileSync("docs/guide.css", "utf8");
fs.writeFileSync(`docs/build/${name}.html`,
  `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title>
<style>${css}</style></head><body>${body}</body></html>`);
' "$name" "$title"
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
    --headless=new --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$HERE/docs/build/$name.pdf" \
    "file:///$HERE/docs/build/$name.html"
  echo "Written to docs/build/$name.pdf"
}

if [ -z "$1" ] || [ "$1" = "project-guide" ]; then
  build project-guide "Closette: An AI-Assisted Smart Wardrobe Management System"
fi
if [ -z "$1" ] || [ "$1" = "team-guide" ]; then
  build team-guide "Closette: Team Guide"
fi
