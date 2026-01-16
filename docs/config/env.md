---
title: env | Config
outline: deep
---

# env

- **Type:** `Partial<NodeJS.ProcessEnv>`

Environment variables available on `process.env` and `import.meta.env` during tests. These variables will not be available in the main process (in `globalSetup`, for example).
