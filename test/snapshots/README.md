# Snapshot Tests

This directory contains integration tests for Vitest's snapshot functionality. It uses a meta-testing approach where integration tests programmatically run fixture tests to validate snapshot behavior.

## Directory Structure

```
test/snapshots/
├── test/              # Integration tests that validate snapshot features
│   └── fixtures/      # Test fixture files (copied to test-update/)
├── test-update/       # Generated directory - populated from fixtures
├── generate.mjs       # Resets test-update/ from fixtures
└── vitest.config.ts   # Test configuration
```

## Test Scripts

| Script | Purpose |
|--------|---------|
| `test` | Runs the complete test suite (all scripts below in sequence) |
| `test:generate` | Resets `test-update/` by copying fresh fixtures |
| `test:update` | Runs tests with `-u` flag to update existing snapshots |
| `test:update-new` | Runs with `CI=false` to create new snapshots |
| `test:update-none` | Runs with `CI=true` to validate without updates (strict mode) |
| `test:integration` | Runs the main integration tests in `test/` |

## How It Works

1. **`generate.mjs`** copies fixture files from `test/fixtures/test-update/` to `test-update/`
2. **`test:update*` scripts** run the fixture tests with different snapshot update modes
3. **`test:integration`** runs integration tests that use `runVitest()` to programmatically execute fixtures and assert on the results

This setup allows testing snapshot features like:
- Inline snapshots (`toMatchInlineSnapshot`)
- File-based snapshots (`toMatchFileSnapshot`)
- Snapshot update behavior with `-u` flag
- CI vs non-CI snapshot creation modes
- Custom serializers, soft assertions, retry logic, etc.

## Running Tests

```bash
# Run all snapshot tests
pnpm test

# Or run individual stages
# - Reset fixtures
pnpm test:generate
# - Run integration tests only
pnpm test:integration
pnpm test:integration test/summary.test.ts

# Run one of fixtures directly
pnpm test:fixtures --root test/fixtures/summary
```
