# Trace View V2 <Badge type="warning" text="Experimental" />

<!-- TODO: experimental version, rename md, better cross link -->

`browser.traceView` introduces a new debugging model for browser tests. Instead of watching a headed browser window while tests run, the browser runs headless by default and every interaction is captured as a DOM snapshot. The trace viewer — a step-by-step replay of your test — becomes the primary debugging surface, the same whether you're developing locally or inspecting a CI failure.

::: tip Difference from the current "browser UI" model

The current default operating mode of local Vitest browser mode is to open a [browser UI](/config/browser/ui) where tests run inside a visible iframe as live view. Only the last test's render state stays visible — each new test clears it. Earlier tests in a run are not inspectable.

The HTML reporter, being static, has no iframe view at all. The two surfaces cover different situations but do not share a debugging model.

The headed browser UI also runs tests with a different concurrency model than headless. With the Playwright provider, headless mode can run test files in parallel by default. In headed mode with the browser UI, this parallelism is not available — so local and CI runs can behave differently without any explicit configuration difference.

`browser.traceView` captures DOM snapshots for every test throughout the run. The same trace viewer appears in the Vitest UI during development and in the HTML report for CI. Since the browser defaults to headless locally as well, local and CI also share the same concurrency model.

:::

## Quick Start

Enable trace view with the [`browser.traceView`](/config/browser/traceview) option:

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

One flag takes care of everything: the browser runs headless, traces are collected, and the viewer is surfaced automatically — in the Vitest UI when developing, as a static HTML report when running in CI.

Selecting a test that has a trace automatically opens the trace viewer in the top panel. The viewer has two panes:

- **Step list** (left) — every recorded interaction and assertion, with name, selector, and source location. Click a step to navigate to it.
- **DOM snapshot** (right) — a reconstruction of the page at the selected step. The interacted element is highlighted in blue.

Clicking on a step's source location jumps to that line in the Editor tab.

<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-light src="/browser/trace-view-light.png">
<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-dark src="/browser/trace-view-dark.png">

## Relation to Playwright Traces

`browser.traceView` and [`browser.trace`](/config/browser/trace) are independent features:

|                        | `browser.traceView`                                       | `browser.trace`                                |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| Provider support       | All providers (playwright, webdriverio, preview)          | Playwright only                                |
| Viewer                 | Vitest UI (built-in)                                      | Playwright Trace Viewer / trace.playwright.dev |
| Format                 | [rrweb](https://github.com/rrweb-io/rrweb) DOM snapshots | Playwright `.trace.zip`                        |
| Requires external tool | No                                                        | Yes (`npx playwright show-trace`)              |

You can enable both at the same time. See [Playwright Trace Files](./trace-view-playwright.md) for the `browser.trace` workflow.

## Recorded Steps

Trace entries are recorded automatically for:

- `expect.element(...)` assertions
- User interaction commands: `click`, `fill`, `type`, `hover`, `selectOptions`, `upload`, `dragAndDrop`, `tab`, `keyboard`, `wheel`
- Screenshots

Each entry captures the DOM state at that point, along with the selector and the source location that triggered it.

Plain JavaScript assertions like `expect(value).toBe(...)` run in Node, not the browser, and do not appear in the trace.

## Custom Trace Entries

You can insert your own named entries with `page.mark()` and `locator.mark()`:

```ts
import { page } from 'vitest/browser'

await page.mark('content rendered')

await page.getByRole('button', { name: 'Sign in' }).mark('sign in button')
```

You can also pass a callback to `page.mark()`. Note that grouping is not currently supported — each inner action is recorded individually, and the mark entry appears at the end:

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

## Headed Mode

By default, `browser.traceView` runs the browser headless. If you want to see the live browser window alongside the trace viewer, pass `--browser.headless=false` explicitly — the headed browser and the trace viewer work together.
