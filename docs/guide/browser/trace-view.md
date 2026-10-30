# Trace View <Version>5.0.0</Version>

Trace view records the steps of a browser test, such as actions, assertions, and marks, together with DOM snapshots of the page. After the test finishes, you can replay them in Vitest's trace viewer to see what happened and what the page looked like.

By default, Vitest records only failed tests, prints their steps in the terminal, and keeps a snapshot of the page when each test failed.

::: tip
For Playwright traces recorded with [`browser.trace`](/config/browser/trace), see [Playwright Traces](./playwright-traces).
:::

## Recording Modes

[`browser.traceView`](/config/browser/traceview) decides which tests Vitest records:

- `'failure-only'` records only failed tests. This is the default. Each trace keeps every step and a snapshot of the page when the test failed.
- `true` or `'on'` records every test with a snapshot at each step. Vitest UI also streams steps as the test runs, so you can inspect them before the test finishes. Long-running actions, `expect.element(...)` assertions, and callback `page.mark()` entries first appear as in-progress steps, then update with their final status and duration.
- `false` or `'off'` turns trace view off.

For example, to record every test:

::: code-group

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      traceView: true,
    },
  },
})
```

```bash [CLI]
vitest --browser.traceView
```

:::

## Failure Output

When a test fails, the error in the terminal is followed by a timeline of its recorded steps:

<<< ./snippets/trace-failure.ansi [Error report]

The timeline lists the same steps as the trace viewer, truncated for long tests and without DOM snapshots. The trace viewer shows every step and the page when the test failed.

## Opening Traces

The trace viewer is available wherever you already look at test results:

| Where                                           | Command                          | What you see                                                                         |
| ----------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| [Browser UI](/config/browser/ui)                | `vitest`                         | The trace viewer next to the live view, which only shows the current page            |
| [Vitest UI](/guide/ui)                          | `vitest --ui --browser.headless` | The trace viewer in each test's report, with tests running in a headless browser     |
| [HTML reporter](/guide/reporters#html-reporter) | `vitest run --reporter=html`     | The trace viewer in the generated report, which suits CI                             |
| Terminal                                        | `vitest run`                     | The step timeline of each failure, as described in [Failure Output](#failure-output) |

To use Vitest UI with a visible browser window instead, see [Headless Mode and UI](/guide/browser/#headless-mode-and-ui).

With the HTML reporter enabled, the [Vitest VS Code extension](https://github.com/vitest-dev/vscode#trace-view) adds an **Open Trace View** action to tests in the Testing view and editor gutter.

## Trace Viewer

The viewer has two resizable panes:

- **Step list** (left) shows every recorded action, assertion, mark, and lifecycle entry, with its name, timing, selector, and source location. Failed actions and assertions are highlighted in red.
- **DOM snapshot** (right) shows the page at the selected step, with the interacted element highlighted in blue. When only failed tests are recorded, the snapshot is taken at the end of the test.

Selecting a step also opens its source location in the Editor tab when that location is available.

<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-light src="/browser/trace-view-light.png">
<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-dark src="/browser/trace-view-dark.png">

<small>Example replay uses [Vuetify's](https://github.com/vuetifyjs/vuetify) `VDateInput` component.</small>

## Recorded Steps

Vitest records a step for:

- `expect.element(...)` assertions
- Interactive actions such as `click`, `dblClick`, `tripleClick`, `fill`, `clear`, `type`, `hover`, `selectOptions`, `upload`, `dragAndDrop`, `tab`, `keyboard`, `wheel`, and screenshots
- Test runner lifecycle events, such as `vitest:onAfterRetryTask` after each test and retry run

Each step records its timing, selector, and the source location that triggered it.

## Custom Trace Entries

You can insert your own named entries with `page.mark()` and `locator.mark()`:

```ts
import { page } from 'vitest/browser'

await page.mark('content rendered')

await page.getByRole('button', { name: 'Sign in' }).mark('sign in button')
```

You can also pass a callback to `page.mark()` to group steps. The mark entry spans the callback, and the actions inside it are nested under the mark in the step list:

```ts
await page.mark('sign in flow', async () => {
  await page.getByRole('textbox', { name: 'Email' }).fill('john@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
})
```

Use [`vi.defineHelper()`](/api/vi#vi-defineHelper) to make entries from reusable helpers point to the call site rather than the helper's internals:

```ts
import { vi } from 'vitest'
import { page } from 'vitest/browser'

const renderContent = vi.defineHelper(async (html: string) => {
  document.body.innerHTML = html
  await page.elementLocator(document.body).mark('render')
})

test('shows button', async () => {
  await renderContent('<button>Hello</button>') // trace entry points here
})
```

## Retries and Repeats

Each retry or repeat of a test is recorded as a separate trace. The viewer opens the most recent attempt, and you can switch between attempts in the Report tab.

## Accessibility Tree <Version>5.1.0</Version> {#accessibility-tree}

Trace view also captures the page's accessibility tree with each snapshot. The view selector in the trace viewer header switches the snapshot pane between **DOM** and **Aria**. The Aria view lists the roles, accessible names, and states that role-based locators such as `getByRole()` see, in the same format as [aria snapshots](/guide/browser/aria-snapshots). Set [`traceView.ariaSnapshot`](/config/browser/traceview#traceview-ariasnapshot) to `false` to disable it.

## What Snapshots Capture

A snapshot captures the DOM tree, attributes, form values, same-origin readable CSS, element scroll positions, viewport size, and window scroll position. Iframe content is not captured, so both same-origin and cross-origin iframes replay as empty frames.

Stylesheets are captured through the browser's CSSOM. Readable `<style>` tags and same-origin `<link rel="stylesheet">` files are serialized into the snapshot and replayed as inline styles, so component styles keep working in the trace viewer and HTML report. The snapshot keeps the rules the browser parsed, not the original stylesheet files. Comments, formatting, and invalid rules are dropped, and files that the CSS references, such as background images and fonts, are not included.

By default, snapshots do not store image or canvas pixels, so images load from their original URLs and canvases replay blank. To store them in the snapshot, enable these options:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      traceView: {
        inlineImages: true,
        recordCanvas: true,
      },
    },
  },
})
```

[`inlineImages`](/config/browser/traceview#traceview-inlineimages) stores the pixels of loaded `<img>` elements in the snapshot, so the HTML report renders them without depending on the original URLs. It captures pixels rather than the original files, which means SVGs are rasterized and animated images become still. Cross-origin images are inlined only when their pixels are CORS-readable. Otherwise they still render from their URL while it stays reachable.

[`recordCanvas`](/config/browser/traceview#traceview-recordcanvas) stores the pixels of each canvas in the snapshot, so every snapshot shows the canvas as it looked at that moment. WebGL canvases come out blank unless they were created with `preserveDrawingBuffer: true`.

::: warning Canvas replay sandbox

rrweb redraws canvas data through an image load handler, so the trace viewer allows scripts inside its replay iframe for traces recorded with `recordCanvas`. Enable this option only when canvas pixels help with debugging.

:::

### External Resource Limits

Trace view has no resource store, so anything that is not captured into the snapshot still loads from its original URL. This includes CSS background images, `@font-face` files, videos, and images that `inlineImages` could not capture. In the browser UI and Vitest UI, these resources usually render fine, because Vitest is still serving your files. On the other hand, in an HTML report opened after the run, they can be missing.

## Relation to Playwright Traces

`browser.traceView` and [`browser.trace`](/config/browser/trace) are independent features, and you can enable both at the same time:

|                        | `browser.traceView`                                      | `browser.trace`                                |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Provider support       | All providers (playwright, webdriverio, preview)         | Playwright only                                |
| Viewer                 | Browser UI / Vitest UI / HTML reporter                   | Playwright Trace Viewer / trace.playwright.dev |
| Format                 | [rrweb](https://github.com/rrweb-io/rrweb) DOM snapshots | Playwright `.trace.zip`                        |
| Requires external tool | No                                                       | Yes (`npx playwright show-trace`)              |

See [Playwright Traces](./playwright-traces) for the `browser.trace` workflow.
