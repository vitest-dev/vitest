---
title: browser.commands | Config
outline: deep
---

# browser.commands

- **Type:** `Record<string, BrowserCommand>`
- **Default:** `{ readFile, writeFile, ... }`

Custom [commands](/api/browser/commands) that can be imported during browser tests from `vitest/browser`.

::: warning Security
Commands run in the Vitest Node process. If a command exposes filesystem, process, network, database, or shell access based on browser-provided input, validate and restrict that input inside the command. Built-in file commands apply Vite `server.fs` checks and write-access checks, but custom commands are responsible for their own protections.

See [Custom Commands security notes](/api/browser/commands#custom-commands).
:::
