---
title: ui | Config
outline: deep
---

# ui <CRoot />

- **Type:** `boolean | object`
- **Default:** `false`
- **CLI:** `--ui`, `--ui=false`

Enable [Vitest UI](/guide/ui). Setting `ui: true` is the same as `ui: { enabled: true }`.

::: warning
This features requires a [`@vitest/ui`](https://npmx.dev/package/@vitest/ui) package to be installed. If you do not have it already, Vitest will install it when you run the test command for the first time.
:::

::: danger SECURITY ADVICE
Make sure that your UI server is not exposed to the network. Since Vitest 4.1 setting [`api.host`](/config/api) to anything other than `localhost` will disable the buttons to save the code or run any tests for security reasons, effectively making UI a readonly reporter.
:::

## ui.enabled <Version type="experimental">5.0.4</Version> {#ui-enabled}

- **Type:** `boolean`
- **Default:** `false`

Enable [Vitest UI](/guide/ui).

## ui.theme <Version type="experimental">5.0.4</Version> {#ui-theme}

- **Type:** `'auto' | 'light' | 'dark'`
- **Default:** `'auto'`

The color theme of Vitest UI and of the [Browser Mode UI](/config/browser/ui). With `'auto'`, the UI follows the system preference and remembers the theme you toggle in the UI. With `'light'` or `'dark'`, the UI opens with this theme on every page load, and the toggle changes it only until the page reloads.

This option does not enable Vitest UI, so you can set it together with [`browser.ui`](/config/browser/ui):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    ui: {
      theme: 'dark',
    },
    browser: {
      enabled: true,
      instances: [
        { browser: 'chromium' },
      ],
    }
  },
})
```
