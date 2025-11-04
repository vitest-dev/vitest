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

## Screenshots in Reports

Vitest UI can display screenshots captured during browser tests. To enable this feature:

1. Enable screenshot capture in your tests using one of these methods:
   - **Manual**: Call `page.screenshot()` in your tests
   - **Automatic**: Enable [`browser.screenshotTestEnd`](/guide/browser/config#browser-screenshottestend)
   - **On Failure**: Enable [`browser.screenshotFailures`](/guide/browser/config#browser-screenshotfailures)

2. Enable screenshot display in the UI:

```ts [vitest.config.ts]
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      screenshotTestEnd: true, // Auto-capture at end of every test
    },
    ui: {
      enabled: true,
      screenshotsInReport: true, // Display in UI
    },
  },
})
```

Screenshots will appear in a carousel viewer in the test report, making it easy to visually verify test behavior. The UI automatically deduplicates screenshot paths, so if a test fails and captures both a failure screenshot and an end-of-test screenshot of the same view, it will only appear once.

### Cleaning Up Screenshots

To prevent screenshot directories from accumulating files across test runs, enable cleanup in your browser configuration:

```ts [vitest.config.ts]
export default defineConfig({
  test: {
    browser: {
      cleanupScreenshots: true, // Clean before running tests
    },
    ui: {
      enabled: true,
      screenshotsInReport: true,
    },
  },
})
```

The cleanup is instance-specific, so screenshots from other browser configurations (e.g., different viewports or browsers) won't be deleted.

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
