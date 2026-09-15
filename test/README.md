Tests are split by categories:

## unit

These tests exercise individual functions and modules. They run in different pools with a single config file.

## e2e

These integration tests exercise CLI behavior and complex interactions by starting Vitest programmatically or as a separate process.

Snapshot integration tests live under `test/e2e/snapshots`. Type-focused fixtures that validate public declarations live under `test/e2e/dts`, while integration tests for Vitest's typechecker live under `test/e2e/typecheck`.

## browser

These tests exercise browser mode and its providers.

## ui

These are Playwright e2e tests for the UI package.

The remaining top-level test directories contain specialized suites that have not yet been consolidated into these categories.
