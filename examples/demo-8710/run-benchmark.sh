#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

echo "==> Generating test files"
node generate-tests.mjs

echo ""
echo "==> Running vitest with blob reporter"
pnpm vitest run --reporter=blob

echo ""
echo "==> Blob size (.vitest-reports/blob.json)"
ls -lh .vitest-reports/blob.json

echo ""
echo "==> Running merge-reports"
time node node_modules/vitest/vitest.mjs run --merge-reports --reporter=json --outputFile.json=./node_modules/.tmp/report.json
