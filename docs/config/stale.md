---
title: stale | Config
outline: deep
---

# stale <CRoot />

- **Type**: `boolean`
- **Default**: `false`
- **CLI:** `--stale`

Run only tests that are stale. A test is considered stale when it or any of its dependencies (recursively) have been modified since the last time tests were run with `--stale`.

The first time tests are run with `--stale`, all tests are executed and a manifest is generated. On subsequent runs, only stale tests are executed. If no tests are stale, Vitest exits with code 0.

This option is useful for fast iteration during development, particularly for agentic coding systems that run tests continuously during their development loops.

Cannot be used together with [`changed`](/guide/cli#changed).

::: tip
When paired with [`forceRerunTriggers`](/config/forcereruntriggers), changes to matched files will cause the entire test suite to run.
:::
