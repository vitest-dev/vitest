---
title: api | Config
outline: deep
---

# api

- **Type:** `boolean | number | object`
- **Default:** `false`
- **CLI:** `--api`, `--api.port`, `--api.host`, `--api.strictPort`

Listen to port and serve API for [the UI](/guide/ui) or [browser server](/guide/browser/). When set to `true`, the default port is `51204`.

## api.allowWrite <Version>4.1.0</Version> {#api-allowwrite}

- **Type:** `boolean`
- **Default:** `true` if not exposed to the network, `false` otherwise

Vitest server can save test files or snapshot files via the API. This allows anyone who can connect to the API the ability to run any arbitary code on your machine.

::: danger SECURITY ADVICE
Vitest does not expose the API to the internet by default and only listens on `localhost`. However if `host` is manually exposed to the network, anyone who connects to it can run arbitrary code on your machine, unless `api.allowWrite` and `api.allowExec` are set to `false`.

If the host is set to anything other than `localhost` or `127.0.0.1`, Vitest will set `api.allowWrite` and `api.allowExec` to `false` by default. This means that any write operations (like changing the code in the UI) will not work. However, if you understand the security implications, you can override them.
:::

## api.allowExec <Version>4.1.0</Version> {#api-allowexec}

- **Type:** `boolean`
- **Default:** `true` if not exposed to the network, `false` otherwise

Allows running any test file via the API. See the security advice in [`api.allowWrite`](#api-allowwrite).
