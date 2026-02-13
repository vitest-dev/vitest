---
title: maxConcurrency | Config
outline: deep
---

# maxConcurrency

- **Type**: `number`
- **Default**: `5`
- **CLI**: `--max-concurrency=10`, `--maxConcurrency=10`

The maximum number of tests and hooks allowed to run at the same time when using `test.concurrent` and `describe.concurrent`.

Tasks above this limit will be queued until a slot becomes available.
