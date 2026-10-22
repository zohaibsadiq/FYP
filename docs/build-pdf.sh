#!/usr/bin/env bash
# Renders docs/project-guide.md to HTML and PDF in docs/build/.
# Needs Node (for marked) and Google Chrome.
set -e
cd "$(dirname "$0")/.."

mkdir -p docs/build
npx --yes marked -i docs/project-guide.md -o docs/build/body.html

node -e '
const fs = require("fs");
const body = fs.readFileSync("docs/build/body.html", "utf8");
const css = fs.readFileSync("docs/guide.css", "utf8");
fs.writeFileSync("docs/build/project-guide.html",
  `<!doctype html><html><head><meta charset="utf-8">
<title>Closette: An AI-Assisted Smart Wardrobe Management System</title>
<style>${css}</style></head><body>${body}</body></html>`);
'

"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --disable-gpu --no-pdf-header-footer \
  --print-to-pdf="$(pwd -W 2>/dev/null || pwd)/docs/build/project-guide.pdf" \
  "file:///$(pwd -W 2>/dev/null || pwd)/docs/build/project-guide.html"

echo "Written to docs/build/project-guide.pdf"
