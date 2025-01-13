---
title: Vitest UI | Guide
---

# Vitest UI

Powered by Vite, Vitest also has a dev server under the hood when running the tests. This allows Vitest to provide a beautiful UI to view and interact with your tests. The Vitest UI is optional, so you'll need to install it with:

```bash
npm i -D @vitest/ui
```

Then you can start the tests with UI by passing the `--ui` flag:

```bash
vitest --ui
```

Then you can visit the Vitest UI at <a href="http://localhost:51204/__vitest__/">`http://localhost:51204/__vitest__/`</a>

::: warning
The UI is interactive and requires a running Vite server, so make sure to run Vitest in `watch` mode (the default). Alternatively, you can generate a static HTML report that looks identical to the Vitest UI by specifying `html` in config's `reporters` option.
:::

<img alt="Vitest UI" img-light src="/ui-1-light.png">
<img alt="Vitest UI" img-dark src="/ui-1-dark.png">

UI can also be used as a reporter. Use `'html'` reporter in your Vitest configuration to generate HTML output and preview the results of your tests:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['html'],
  },
})
```

You can check your coverage report in Vitest UI: see [Vitest UI Coverage](/guide/coverage#vitest-ui) for more details.

::: warning
If you still want to see how your tests are running in real time in the terminal, don't forget to add `default` reporter to `reporters` option: `['default', 'html']`.
:::

::: tip
To preview your HTML report, you can use the [vite preview](https://vitejs.dev/guide/cli.html#vite-preview) command:

```sh
npx vite preview --outDir ./html
```

You can configure output with [`outputFile`](/config/#outputfile) config option. You need to specify `.html` path there. For example, `./html/index.html` is the default value.
:::
