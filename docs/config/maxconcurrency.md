---
title: maxConcurrency | Config
outline: deep
---

# maxConcurrency

- **Type**: `number`
- **Default**: `5`
- **CLI**: `--max-concurrency=10`, `--maxConcurrency=10`

The maximum number of tests and suite lifecycle hooks allowed to run at the same time when using `test.concurrent` and `describe.concurrent`.

Entries above this limit are queued until a slot becomes available.

Within each running test or suite, hooks at the same level can still run fully in parallel when [`sequence.hooks`](/config/sequence#sequence-hooks) is set to `parallel` (for example, `beforeEach` / `afterEach`, and `beforeAll` / `afterAll` registered in the same suite).
