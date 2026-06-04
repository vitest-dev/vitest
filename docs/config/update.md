---
title: update | Config
outline: deep
---

# update <CRoot /> {#update}

- **Type:** `boolean | 'new' | 'all' | 'none'`
- **Default:** `false`
- **CLI:** `-u`, `--update`, `--update=false`, `--update=new`, `--update=none`

Define snapshot update behavior.

- `true` or `'all'`: updates all changed snapshots and deletes obsolete ones
- `new`: generates new snapshots without changing or deleting obsolete ones
- `none`: does not write snapshots and fails on snapshot mismatches, missing snapshots, and obsolete snapshots

When `update` is `false` (the default), Vitest resolves snapshot update mode by environment:

- Local runs (non-CI): works same as `new`
- CI runs (`process.env.CI` is truthy): works same as `none`
