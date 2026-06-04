---
title: execArgv | Config
outline: deep
---

# execArgv

- **Type:** `string[]`
- **Default:** `[]`

Pass additional arguments to `node` in the runner worker. See [Command-line API | Node.js](https://nodejs.org/docs/latest/api/cli.html) for more information.

:::warning
Be careful when using, it as some options may crash worker, e.g. `--prof`, `--title`. See https://github.com/nodejs/node/issues/41103.
:::
