---
title: maxConcurrency | Config
outline: deep
---

# maxConcurrency

- **Type**: `number`
- **Default**: `5`
- **CLI**: `--max-concurrency=10`, `--maxConcurrency=10`

The maximum number of tests and hooks that can run at the same time when using `test.concurrent` or `describe.concurrent`.

The execution order of hooks within a single group is controlled by [`sequence.hooks`](/config/sequence#sequence-hooks). With `sequence.hooks: 'parallel'`, the parallelism is limited by `maxConcurrency`.
