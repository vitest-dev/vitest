---
title: Recipes | Guide
---

# Recipes

Recipes are end-to-end patterns that solve a concrete problem by combining multiple Vitest features. Each recipe addresses a specific scenario you may encounter when writing tests.

## Setup and Teardown

- **[Database Transaction per Test](/guide/recipes/db-transaction)** — Keep integration tests fast and isolated by wrapping each test in a transaction that rolls back automatically, with no truncate scripts or cleanup boilerplate.
- **[Auto-Cleanup with `using`](/guide/recipes/explicit-resources)** — Declare spies and mocks with `using` instead of `const` so they restore themselves when the block exits, using the Explicit Resource Management syntax.
- **[Per-File Isolation Settings](/guide/recipes/disable-isolation)** — Disable module isolation for fast unit tests while keeping it enabled for integration tests that genuinely need it, using projects.

## Async and Concurrency

- **[Waiting for Async Conditions](/guide/recipes/wait-for)** — Poll until a condition holds instead of sleeping with `setTimeout`. Covers server startup, DOM renders, and any state that settles asynchronously.
- **[Cancelling Long-Running Operations Gracefully](/guide/recipes/cancellable)** — Pass the test-scoped `AbortSignal` to `fetch`, child processes, and polling loops so Vitest can cancel them cleanly on timeout or bail.
- **[Parallel and Sequential Test Files](/guide/recipes/parallel-sequential)** — Run most files in parallel while a small group that shares an exclusive resource (a fixed port, a writable directory) runs sequentially, without slowing down the rest.

## Assertions

- **[Type Narrowing in Tests](/guide/recipes/type-narrowing)** — Replace unsafe `as` casts and `!` non-null assertions with `expect.assert`, which throws at runtime and narrows the TypeScript type in one call.
- **[Custom Assertion Helpers](/guide/recipes/custom-assertions)** — Wrap reusable assertion functions with `vi.defineHelper` so stack traces on failure point at the test call site, not inside the helper.
- **[Schema-Driven Assertions](/guide/recipes/schema-matching)** — Reuse existing Zod, Valibot, or ArkType schemas directly in assertions with `expect.schemaMatching` instead of duplicating shape checks.

## Watch Mode and Browser

- **[Watching Non-Imported Files](/guide/recipes/watch-templates)** — Trigger reruns for files that tests depend on but don't `import`, such as templates loaded with `fs.readFile`, JSON fixtures, or generated artifacts.
- **[Extending Browser Locators](/guide/recipes/browser-locators)** — Extend the built-in browser locators with custom queries for app-specific DOM shapes, keeping auto-retry and strict-mode protection.
