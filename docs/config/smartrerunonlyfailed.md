---
title: smartRerunOnlyFailed | Config
outline: deep
---

# smartRerunOnlyFailed

- **Type:** `boolean`
- **CLI:** `--smartRerunOnlyFailed`, `--smart-rerun-only-failed`
- **Default:** `false`

Requires [`smartRerun`](/config/smartrerun) to be enabled. Instead of just moving previously failed tests to the front, skips files that passed in the previous run entirely and only runs files from the failed tests cache. Falls back to running every file when the cache is empty or none of the cached files still exist.

::: warning
Skipped files are not part of the run's report, the same way files excluded by `--shard` are not reported. Regressions introduced in skipped files won't be caught until a full run (without this option) happens.
:::
