---
title: smartRerun | Config
outline: deep
---

# smartRerun

- **Type:** `boolean`
- **CLI:** `--smartRerun`, `--smart-rerun`
- **Default:** `false`

Cache the file paths of failed tests in `.vitest-failed-cache.json` in the project root. On the next run, previously failed tests are moved to the front of the test queue so they run first, ahead of the rest of the suite. The cache file is automatically removed once all tests pass.

See [`smartRerunOnlyFailed`](/config/smartrerunonlyfailed) to skip files that passed in the previous run instead of just reordering them.
