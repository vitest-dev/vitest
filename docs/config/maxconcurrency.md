---
title: maxConcurrency | Config
outline: deep
---

# maxConcurrency

- **Type**: `number`
- **Default**: `5`
- **CLI**: `--max-concurrency=10`, `--maxConcurrency=10`

The maximum number of tests and hooks that can run at the same time.

[`sequence.hooks`](/config/sequence#sequence-hooks) controls hook ordering. With `sequence.hooks: 'parallel'`, hook execution is bounded by this `maxConcurrency` limit.
