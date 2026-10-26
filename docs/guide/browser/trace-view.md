# Trace View <Version>5.0.0</Version>

`browser.traceView` records browser interactions as DOM snapshots and lets you replay them step by step in Vitest's built-in trace viewer. It is useful when the live browser view is not enough: you can inspect earlier tests, failed retries, screenshots, assertions, and user actions after the browser has already moved on.

By default, Vitest records traces only for failed tests, so every browser test failure prints a [timeline of its recorded steps](#failure-output) in the terminal. The trace keeps a DOM snapshot of the page when the test failed, which you can open in the browser UI, Vitest UI, or HTML reporter. To snapshot every step, set [`browser.traceView.mode`](/config/browser/traceview#traceview-mode) to `'on'`. Trace view works with your existing debugging setup, whether that is the normal local browser UI, a headless browser with Vitest UI, or the HTML reporter in CI.

::: tip Trace view, browser UI, and HTML reports

The normal local browser mode opens the [browser UI](/config/browser/ui), where tests run in a visible iframe. This is useful while developing, but the iframe only shows the current browser state. When another test runs, the previous rendered state is gone.

`browser.traceView` keeps a replayable record for each recorded test. In local browser UI mode, the trace viewer appears alongside the existing live view so you can keep using the browser UI while also inspecting recorded steps.

For static output, add the [HTML reporter](/guide/reporters#html-reporter). The same trace viewer can then be opened from the generated report, which is useful for run-mode and CI failures.

:::

::: details Looking for Playwright traces?

This page now documents Vitest's built-in `browser.traceView` feature. The previous `browser.trace` guide for Playwright traces moved to [Playwright Traces](./playwright-traces).

:::

## Quick Start

Failed tests are recorded without any configuration. To record passing tests too, set the [`browser.traceView`](/config/browser/traceview) option to `true`, or set it to `false` to turn trace view off:

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

Tests with recorded traces can be opened in the trace viewer from the [browser UI](/config/browser/ui), [Vitest UI](/guide/ui), and [HTML reporter](/guide/reporters#html-reporter). Failed tests also print their recorded steps in the terminal, as described in [Failure Output](#failure-output).

With the HTML reporter enabled, the [Vitest VS Code extension](https://github.com/vitest-dev/vscode#trace-view) adds an **Open Trace View** action to tests in the Testing view and editor gutter.

The viewer has two resizable panes:

- **Step list** (left) — every recorded action, assertion, mark, and lifecycle entry, with name, timing, selector, and source location. Failed actions and assertions are highlighted in red.
- **DOM snapshot** (right) — a reconstruction of the page at the selected step. The interacted element is highlighted in blue.

Selecting a step also opens its source location in the Editor tab when that location is available.

<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-light src="/browser/trace-view-light.png">
<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-dark src="/browser/trace-view-dark.png">

<small>Example replay uses [Vuetify's](https://github.com/vuetifyjs/vuetify) `VDateInput` component.</small>

## Common Setups

<!--
TODO: The browser UI / Vitest UI / browser driver combinations are not specific to trace view and might be better documented in the Browser Mode guide.  Something like:

  | top-level --ui | browser.ui | browser.headless | Result |
  | --- | --- | --- | --- |
  | off | true | false | browser UI/live iframe in headed browser |
  | on | false | true | pure Vitest UI, tests in headless browser |
  | on | false | false | pure Vitest UI, tests in separate headed browser window |

-->

`browser.traceView` records traces. The browser mode, UI, and reporter options determine where you inspect them.

| Goal                                                      | Configuration                                                                 | Result                                                                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Add trace replay to the normal local browser UI           | `vitest --browser.traceView`                                                  | Uses the default local headed browser UI and adds trace replay for every test.                                            |
| Debug locally with a headless browser                     | `vitest --browser.traceView --browser.headless --ui`                          | The browser runs headless, while Vitest UI shows recorded trace steps and snapshots.                                      |
| Debug locally with a visible browser window and Vitest UI | `vitest --browser.traceView --browser.headless=false --browser.ui=false --ui` | Vitest UI shows recorded trace steps and snapshots, while tests run in a separate headed browser window.                  |
| See failure steps in CI logs or from a coding agent       | `vitest run`                                                                  | The failure summary in the terminal includes a timeline of the steps that led to each failure.                            |
| Inspect failures in CI or run mode                        | `vitest run --reporter=default --reporter=html`                               | The terminal shows the failure timeline, and the HTML report shows the full step list with the page when the test failed. |

## Relation to Playwright Traces

`browser.traceView` and [`browser.trace`](/config/browser/trace) are independent features:

|                        | `browser.traceView`                                      | `browser.trace`                                |
| ---------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Provider support       | All providers (playwright, webdriverio, preview)         | Playwright only                                |
| Viewer                 | Browser UI / Vitest UI / HTML reporter                   | Playwright Trace Viewer / trace.playwright.dev |
| Format                 | [rrweb](https://github.com/rrweb-io/rrweb) DOM snapshots | Playwright `.trace.zip`                        |
| Requires external tool | No                                                       | Yes (`npx playwright show-trace`)              |

You can enable both at the same time. See [Playwright Traces](./playwright-traces) for the `browser.trace` workflow.

## Recorded Steps

Trace entries are recorded automatically for:

- `expect.element(...)` assertions
- Interactive actions like `click`, `dblClick`, `tripleClick`, `fill`, `clear`, `type`, `hover`, `selectOptions`, `upload`, `dragAndDrop`, `tab`, `keyboard`, `wheel`, and screenshots
- Test runner lifecycle event (e.g. `vitest:onAfterRetryTask` is recorded after each test and retry run)

Each entry captures the DOM state at that point, along with timing information, the selector, and the source location that triggered it.

In Vitest UI, trace entries are streamed as the test runs, so you can inspect recorded steps before the test finishes. Long-running actions, `expect.element(...)` assertions, and callback `page.mark()` entries appear as in-progress steps first, then update with their final status and duration.

## Failure Output

When a test fails, the error in the terminal is followed by a timeline of its recorded steps:

<<< ./snippets/trace-failure.ansi [Error report]

These are the last 10 steps the trace viewer lists, without DOM snapshots. To inspect the full step list and the page when the test failed, keep the default reporter and add the [HTML reporter](/guide/reporters#html-reporter):

```bash
vitest run --reporter=default --reporter=html
```

Set [`browser.traceView.mode`](/config/browser/traceview#traceview-mode) to `'on'` to snapshot every step.

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

Each attempt — retry or repeat — is recorded as a separate trace. When a test has multiple attempts, the viewer opens the most recent one by default. You can switch between attempts in the Report tab.

## Accessibility Tree <Version>5.1.0</Version> {#accessibility-tree}

Trace view also captures the page's accessibility tree at each step. The trace viewer header shows a view selector to switch the snapshot pane between **DOM** and **Aria**. The Aria view lists the roles, accessible names, and states that role-based locators such as `getByRole()` see, in the same format as [aria snapshots](/guide/browser/aria-snapshots). Set [`traceView.ariaSnapshot`](/config/browser/traceview#traceview-ariasnapshot) to `false` to disable it.

## Snapshot Fidelity

By default, trace view captures the DOM tree, attributes, form values, same-origin readable CSS, element scroll positions, viewport size, and window scroll position. Images and canvas pixels are not inlined by default.

Stylesheets are captured through the browser's CSSOM. Readable `<style>` tags and same-origin `<link rel="stylesheet">` files are serialized into the snapshot and replayed as inline styles, so normal component styles keep working in the trace viewer and HTML reporter. This captures the parsed CSS rules the browser applied, not the exact original stylesheet bytes: comments, formatting, invalid rules, and CSS resource files such as background images or fonts are not bundled this way.

Enable additional fidelity options with the object form:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      traceView: {
        mode: 'on',
        inlineImages: true,
        recordCanvas: true,
      },
    },
  },
})
```

`inlineImages` stores loaded `<img>` pixels in the trace snapshot. This is mostly useful for the HTML reporter, where the report should be portable without depending on external image URLs. This is pixel capture, not original resource capture: SVGs are rasterized, animated images are not preserved as animations, and CSS background images or fonts are not covered. Cross-origin images need CORS-readable pixels to be inlined; otherwise they can still render from the external URL if it remains reachable.

`recordCanvas` stores readable canvas pixels in the trace snapshot. This is useful for charts and simple 2D canvas output, but it is not a full canvas drawing timeline and does not provide complete WebGL replay.

### External Resource Limits

Trace view does not currently provide a general resource store. Resources that are not captured into the snapshot remain URL-backed.

This means CSS background images and `@font-face` files referenced from serialized CSS still depend on their original URLs. External images can still render in the viewer when the browser can load the URL, but they are not portable in the HTML reporter unless `inlineImages` can capture their pixels. Cross-origin images need CORS-readable pixels for that capture; otherwise the browser can display them, but rrweb cannot safely draw them into a canvas data URL.

Use `inlineImages` for loaded `<img>` elements that need to be portable in the HTML reporter. CSS subresources, fonts, non-CORS cross-origin images, videos, and other external files remain limitations of the current snapshot-based trace format.

::: warning Canvas replay sandbox

`recordCanvas` enables a weaker iframe sandbox in the trace viewer. rrweb replays canvas data through an image load handler, so Vitest allows scripts inside the replay iframe for traces recorded with `recordCanvas`. Keep this option enabled only when canvas pixels are useful for debugging.

:::
