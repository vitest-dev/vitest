# Snapshot Tests

This directory contains integration tests for Vitest's snapshot functionality. It uses a meta-testing approach where integration tests programmatically run fixture tests to validate snapshot behavior.

```bash
# Run all tests
pnpm test

# Run one of fixtures directly
pnpm test --root test/fixtures/summary
```
