---
title: ui | Config
outline: deep
---

# ui <CRoot />

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--ui`, `--ui=false`

Enable [Vitest UI](/guide/ui).

::: warning
This features requires a [`@vitest/ui`](https://www.npmjs.com/package/@vitest/ui) package to be installed. If you do not have it already, Vitest will install it when you run the test command for the first time.
:::

::: danger SECURITY ADVICE
Make sure that your UI server is not exposed to the network. Since Vitest 4.1 setting [`api.host`](/config/api) to anything other than `localhost` will disable the buttons to save the code or run any tests for security reasons, effectively making UI a readonly reporter.
:::
