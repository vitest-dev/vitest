---
title: watch | Config
outline: deep
---

# watch <CRoot /> {#watch}

- **Type:** `boolean`
- **Default:** `!process.env.CI && process.stdin.isTTY`
- **CLI:** `-w`, `--watch`, `--watch=false`

Enable watch mode

In interactive environments, this is the default, unless `--run` is specified explicitly.

In CI, or when run from a non-interactive shell, "watch" mode is not the default, but can be enabled explicitly with this flag.
