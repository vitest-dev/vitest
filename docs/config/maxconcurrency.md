---
title: maxConcurrency | Config
outline: deep
---

# maxConcurrency

- **Type**: `number`
- **Default**: `5`
- **CLI**: `--max-concurrency=10`, `--maxConcurrency=10`

The maximum number of tests and hooks that can run at the same time.

Anything above this limit is queued until a slot becomes available.

[`sequence.hooks`](/config/sequence#sequence-hooks) controls hook ordering. Even when it is set to `parallel`, hook execution still respects this `maxConcurrency` limit.
