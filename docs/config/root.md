---
title: root | Config
outline: deep
---

# root

- **Type:** `string`
- **CLI:** `-r <path>`, `--root=<path>`

Project root. A relative path is resolved against the current working directory, except in [projects](/guide/projects): a project config file resolves it against its own directory, and an inline project resolves it against the root of the config that declares it.
