---
title: browser.trace | Config
outline: deep
---

# browser.trace

- **Type:** `'on' | 'off' | 'on-first-retry' | 'on-all-retries' | 'retain-on-failure' | object`
- **CLI:** `--browser.trace=on`, `--browser.trace=retain-on-failure`
- **Default:** `'off'`

Capture a trace of your browser test runs. You can preview traces with [Playwright Trace Viewer](https://trace.playwright.dev/).

This options supports the following values:

- `'on'` - capture trace for all tests. (not recommended as it's performance heavy)
- `'off'` - do not capture traces.
- `'on-first-retry'` - capture trace only when retrying the test for the first time.
- `'on-all-retries'` - capture trace on every retry of the test.
- `'retain-on-failure'` - capture trace only for tests that fail. This will automatically delete traces for tests that pass.
- `object` - an object with the following shape:

```ts
interface TraceOptions {
  mode: 'on' | 'off' | 'on-first-retry' | 'on-all-retries' | 'retain-on-failure'
  /**
   * The directory where all traces will be stored. By default, Vitest
   * stores all traces in `__traces__` folder close to the test file.
   */
  tracesDir?: string
  /**
   * Whether to capture screenshots during tracing. Screenshots are used to build a timeline preview.
   * @default true
   */
  screenshots?: boolean
  /**
   * If this option is true tracing will
   * - capture DOM snapshot on every action
   * - record network activity
   * @default true
   */
  snapshots?: boolean
}
```

::: danger WARNING
This option is supported only by the [**playwright**](/config/browser/playwright) provider.
:::
