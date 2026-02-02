---
title: update | Config
outline: deep
---

# update <CRoot /> {#update}

- **Type:** `boolean | 'new' | 'all'`
- **Default:** `false`
- **CLI:** `-u`, `--update`, `--update=false`, `--update=new`

Update snapshot files. The behaviour depends on the value:

- `true` or `'all'`: updates all changed snapshots and delete obsolete ones
- `new`: generates new snapshots without changing or deleting obsolete ones
