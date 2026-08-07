#!/usr/bin/env bash
#
# Olympus test runner for the browser list mock-isolation regression.
# Supports two modes:
#   ./test.sh --output_path <path> base
#   ./test.sh --output_path <path> new
#
# JUnit XML is always written to <path>, even on failure.
# NOTE: intentionally NOT using "set -e" so the script keeps running and
# always emits JUnit XML, as required by the Olympus sanity checks.

output_path=""
if [[ "${1:-}" == "--output_path" ]]; then
  output_path="${2:-}"
  shift 2
fi

mode="${1:-}"
if [[ -z "$output_path" || -z "$mode" ]]; then
  echo "usage: ./test.sh --output_path <path> <base|new>" >&2
  exit 2
fi

if [[ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]]; then
  for candidate in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome; do
    if [[ -x "$candidate" ]]; then
      export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$candidate"
      break
    fi
  done
fi

write_junit() {
  local name="$1"
  local status="$2"
  local log_file="$3"
  node - "$output_path" "$name" "$status" "$log_file" <<'NODE'
const fs = require('node:fs')
const [outputPath, name, status, logFile] = process.argv.slice(2)
let log = ''
try { log = fs.readFileSync(logFile, 'utf8') } catch (e) { log = '' }
const escape = value => String(value).replace(/[<>&'"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[char]))
const failed = status !== '0'
const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<testsuite name="vitest-browser-list" tests="1" failures="${failed ? 1 : 0}">`,
  `  <testcase classname="vitest-browser-list" name="${escape(name)}">`,
  failed ? `    <failure message="command failed (exit ${status})">${escape(log)}</failure>` : '',
  '  </testcase>',
  '</testsuite>',
  '',
].filter(Boolean).join('\n')
fs.writeFileSync(outputPath, xml)
NODE
}

run_case() {
  local name="$1"
  shift
  local log_file
  log_file="$(mktemp)"
  "$@" >"$log_file" 2>&1
  local status=$?
  cat "$log_file"
  write_junit "$name" "$status" "$log_file"
  rm -f "$log_file"
  return "$status"
}

case "$mode" in
  base)
    run_case "browser package typecheck" pnpm -C packages/browser typecheck
    ;;
  new)
    run_case "browser list mock isolation" bash -lc 'pnpm --filter @vitest/browser build && CI=true pnpm -C test/e2e test list.test.ts -t "isolates browser mocks between files while listing"'
    ;;
  *)
    echo "unknown mode: $mode" >&2
    echo "unknown mode" >"$output_path.invalid" 2>/dev/null || true
    exit 2
    ;;
esac
