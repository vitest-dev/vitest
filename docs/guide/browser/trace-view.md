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

You can also group multiple operations under one marker with `page.mark(name, callback)`:

```ts
await page.mark('sign in flow', async () => {
  await page.getByRole('textbox', { name: 'Email' }).fill('john@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
})
```

You can also wrap reusable helpers with [`vi.defineHelper()`](/api/vi#vi-defineHelper) so trace entries point to where the helper is called, not its internals:

```ts
import { vi } from 'vitest'
import { page } from 'vitest/browser'

const myRender = vi.defineHelper(async (content: string) => {
  document.body.innerHTML = content
  await page.elementLocator(document.body).mark('render helper')
})

test('renders content', async () => {
  await myRender('<button>Hello</button>') // trace points to this line
})
```

## Preview

To open the trace file, you can use the Playwright Trace Viewer. Run the following command in your terminal:

```bash
npx playwright show-trace "path-to-trace-file"
```

This will start the Trace Viewer and load the specified trace file.

Alternatively, you can open the Trace Viewer in your browser at https://trace.playwright.dev and upload the trace file there.

## Source Location

When you open a trace, you'll notice that Vitest groups browser interactions and links them back to the exact line in your test that triggered them. This happens automatically for:

- `expect.element(...)` assertions
- Interactive actions like `click`, `fill`, `type`, `hover`, `selectOptions`, `upload`, `dragAndDrop`, `tab`, `keyboard`, `wheel`, and screenshots

Under the hood, Playwright still records its own low-level action events as usual. Vitest wraps them with source-location groups so you can jump straight from the trace timeline to the relevant line in your test.

Keep in mind that plain assertions like `expect(value).toBe(...)` run in Node, not the browser, so they won't show up in the trace.

For anything not covered automatically, you can use `page.mark()` or `locator.mark()` to add your own trace groups — see [Trace markers](#trace-markers) above.

::: warning

Currently a source view of a trace can be only displayed properly when viewing it on the machine generated a trace with `playwright show-trace` CLI. This is expected to be fixed soon (see https://github.com/microsoft/playwright/pull/39307).

:::
