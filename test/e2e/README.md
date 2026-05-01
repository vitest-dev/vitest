# e2e

# Snapshots

This directory [`./snapshots`](./snapshots) contains integration tests for Vitest's snapshot functionality. It uses a meta-testing approach where integration tests programmatically run fixture tests to validate snapshot behavior, such as, snapshot update, snapshot error formatting, summary reporting, obsolete snapshots handling, etc.

```bash
# Run all integration tests
pnpm test --project=snapshots

# Run one fixture directly
pnpm test --root snapshots/fixtures/domain
```
