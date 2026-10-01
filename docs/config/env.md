---
title: env | Config
outline: deep
---

# env

- **Type:** `Partial<NodeJS.ProcessEnv>`

Environment variables available on `process.env` and `import.meta.env` during tests. These variables will not be available in the main process (in `globalSetup`, for example).

::: warning
`TZ` set here does not change the time zone in `threads` and `vmThreads` pools. See [Time Zone Does Not Change in Worker Threads](/guide/common-errors#time-zone-does-not-change-in-worker-threads).
:::
