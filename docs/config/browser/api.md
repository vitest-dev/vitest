---
title: browser.api | Config
outline: deep
---

# browser.api

- **Type:** `number | object`
- **Default:** `63315`
- **CLI:** `--browser.api=63315`, `--browser.api.port=1234, --browser.api.host=example.com`

Configure options for Vite server that serves code in the browser. Does not affect [`test.api`](#api) option. By default, Vitest assigns port `63315` to avoid conflicts with the development server, allowing you to run both in parallel.

## api.allowWrite <Version>4.1.0</Version> {#api-allowwrite}

- **Type:** `boolean`
- **Default:** `true` if not exposed to the network, `false` otherwise

Vitest saves [annotation attachments](/guide/test-annotations), [artifacts](/api/advanced/artifacts) and [snapshots](/guide/snapshot) by receiving a WebSocket connection from the browser. This allows anyone who can connect to the API write any arbitary code on your machine within the root of your project (configured by [`fs.allow`](https://vite.dev/config/server-options#server-fs-allow)).

If browser server is not exposed to the internet (the host is `localhost`), this should not be a problem, so the default value in that case is `true`. If you override the host, Vitest will set `allowWrite` to `false` by default to prevent potentially harmful writes.

## api.allowExec <Version>4.1.0</Version> {#api-allowexec}

- **Type:** `boolean`
- **Default:** `true` if not exposed to the network, `false` otherwise

Allows running any test file via the UI. This only applies to the interactive elements (and the server code behind them) in the [UI](/guide/ui) that can run the code. If UI is disabled, this has no effect. See [`api.allowExec`](/config/api#api-allowexec) for more information.
