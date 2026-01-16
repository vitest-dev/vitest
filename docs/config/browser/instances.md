---
title: browser.instances | Config
outline: deep
---

# browser.instances

- **Type:** `BrowserConfig`
- **Default:** `[]`

Defines multiple browser setups. Every config has to have at least a `browser` field.

You can specify most of the [project options](/config/) (not marked with a <CRoot /> icon) and some of the `browser` options like `browser.testerHtmlPath`.

::: warning
Every browser config inherits options from the root config:

```ts{3,9} [vitest.config.ts]
export default defineConfig({
  test: {
    setupFile: ['./root-setup-file.js'],
    browser: {
      enabled: true,
      testerHtmlPath: './custom-path.html',
      instances: [
        {
          // will have both setup files: "root" and "browser"
          setupFile: ['./browser-setup-file.js'],
          // implicitly has "testerHtmlPath" from the root config // [!code warning]
          // testerHtmlPath: './custom-path.html', // [!code warning]
        },
      ],
    },
  },
})
```

For more examples, refer to the ["Multiple Setups" guide](/guide/browser/multiple-setups).
:::

List of available `browser` options:

- `browser` (the name of the browser)
- [`headless`](/config/browser/headless)
- [`locators`](/config/browser/locators)
- [`viewport`](/config/browser/viewport)
- [`testerHtmlPath`](/config/browser/testerhtmlpath)
- [`screenshotDirectory`](/config/browser/screenshotdirectory)
- [`screenshotFailures`](/config/browser/screenshotfailures)
- [`provider`](/config/browser/provider)

Under the hood, Vitest transforms these instances into separate [test projects](/api/advanced/test-project) sharing a single Vite server for better caching performance.
