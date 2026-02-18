# Trace View

Vitest Browser Mode supports generating Playwright's [trace files](https://playwright.dev/docs/trace-viewer#viewing-remote-traces). To enable tracing, you need to set the [`trace`](/config/browser/trace) option in the `test.browser` configuration.

::: warning
Generating trace files is only available when using the [Playwright provider](/config/browser/playwright).
:::

::: code-group
```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      trace: 'on',
    },
  },
})
```
```bash [CLI]
vitest --browser.trace=on
```
:::

By default, Vitest will generate a trace file for each test. You can also configure it to only generate traces on test failures by setting `trace` to `'on-first-retry'`, `'on-all-retries'` or `'retain-on-failure'`. The files will be saved in `__traces__` folder next to your test files. The name of the trace includes the project name, the test name, the [`repeats`](/api/test#repeats) count and [`retry`](/api/test#retry) count:

```
chromium-my-test-0-0.trace.zip
^^^^^^^^ project name
         ^^^^^^ test name
                ^ repeat count
                  ^ retry count
```

To change the output directory, you can set the `tracesDir` option in the `test.browser.trace` configuration. This way all traces will be stored in the same directory, grouped by the test file.

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      trace: {
        mode: 'on',
        // the path is relative to the root of the project
        tracesDir: './playwright-traces',
      },
    },
  },
})
```

The traces are available in reporters as [annotations](/guide/test-annotations). For example, in the HTML reporter, you can find the link to the trace file in the test details.

## Trace markers

You can add explicit named markers to make the trace timeline easier to read:

```ts
import { page } from 'vitest/browser'

document.body.innerHTML = `
  <button type="button">Sign in</button>
`

await page.getByRole('button', { name: 'Sign in' }).mark('sign in button rendered')
```

Both `page.mark(name)` and `locator.mark(name)` are available.

## Preview

To open the trace file, you can use the Playwright Trace Viewer. Run the following command in your terminal:

```bash
npx playwright show-trace "path-to-trace-file"
```

This will start the Trace Viewer and load the specified trace file.

Alternatively, you can open the Trace Viewer in your browser at https://trace.playwright.dev and upload the trace file there.

## Limitations

Trace Viewer source linking is currently partially supported.

Regular Playwright action events (for example `locator.click()`) might not include source entries, while marker-backed events do. `page.mark(name)`, `locator.mark(name)`, and automatic markers from `expect.element(...)` include callsite metadata and are the most reliable way to correlate trace steps with test source.

Non-browser assertions (for example `expect(value).toBe(...)`) don't interact with the browser and won't create browser trace markers.
