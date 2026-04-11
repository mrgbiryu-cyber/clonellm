#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[1/4] branch"
git -C "$ROOT_DIR" branch --show-current

echo "[2/4] staged count"
git -C "$ROOT_DIR" diff --cached --name-only | wc -l

echo "[3/4] staged ignore leakage"
if git -C "$ROOT_DIR" diff --cached --name-only | rg -q '^(data/runtime|data/visual|data/debug|data/reports|tmp|node_modules)/'; then
  echo "FAIL: ignored/generated path leaked into staged set"
  git -C "$ROOT_DIR" diff --cached --name-only | rg '^(data/runtime|data/visual|data/debug|data/reports|tmp|node_modules)/'
  exit 1
fi
echo "OK: no ignored/generated staged paths"

echo "[4/4] node syntax"
node --check "$ROOT_DIR/server.js"
node --check "$ROOT_DIR/auth.js"
node --check "$ROOT_DIR/llm.js"
echo "OK: syntax checks passed"
