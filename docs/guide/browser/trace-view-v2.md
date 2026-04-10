# Trace View

Vitest Browser Mode has a built-in trace viewer that captures DOM snapshots as your tests run and shows them directly in the Vitest UI — no external tools required.

## Quick Start

Enable trace view with the [`browser.traceView`](/config/browser/traceview) option:

::: code-group

```ts [vitest.config.ts]
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    browser: {
      provider: playwright(),
      traceView: true,
    },
  },
});
```

```bash [CLI]
vitest --browser.traceView
```

:::

In watch mode, Vitest automatically opens the UI. In CI or one-shot runs, the HTML reporter is added automatically so traces are accessible from the generated report.

Enabling `browser.traceView` also defaults `browser.headless` to `true` so the browser runs in the background while you inspect traces in the UI.

## What You See

When you select a test that has a trace, the top panel switches to the trace viewer automatically.

The viewer has two panes:

- **Step list** (left) — every recorded interaction and assertion, with name, selector, and source location. Click a step to navigate to it.
- **DOM snapshot** (right) — a reconstruction of the page at the selected step. The interacted element is highlighted in blue.

Clicking on a step's source location jumps to that line in the Editor tab.

<!-- TODO: screenshot of the full trace viewer — step list on the left, DOM snapshot on the right, element highlighted in blue -->
<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-light src="/browser/trace-view-light.png">
<img alt="Vitest UI trace viewer showing step list and DOM snapshot" img-dark src="/browser/trace-view-dark.png">

## What Gets Traced

Trace entries are recorded automatically for:

- `expect.element(...)` assertions
- User interaction commands: `click`, `fill`, `type`, `hover`, `selectOptions`, `upload`, `dragAndDrop`, `tab`, `keyboard`, `wheel`
- Screenshots

Each entry captures the DOM state at that point, along with the selector and the source location that triggered it.

Plain JavaScript assertions like `expect(value).toBe(...)` run in Node, not the browser, and do not appear in the trace.

## Custom Trace Entries

You can insert your own named entries with `page.mark()` and `locator.mark()`:

```ts
import { page } from "vitest/browser";

await page.mark("content rendered");

await page.getByRole("button", { name: "Sign in" }).mark("sign in button");
```

To group multiple operations under a single entry:

```ts
await page.mark("sign in flow", async () => {
  await page.getByRole("textbox", { name: "Email" }).fill("john@example.com");
  await page.getByRole("textbox", { name: "Password" }).fill("secret");
  await page.getByRole("button", { name: "Sign in" }).click();
});
```

Use [`vi.defineHelper()`](/api/vi#vi-defineHelper) to make entries from reusable helpers point to the call site rather than the helper's internals:

```ts
import { vi } from "vitest";
import { page } from "vitest/browser";

const renderContent = vi.defineHelper(async (html: string) => {
  document.body.innerHTML = html;
  await page.elementLocator(document.body).mark("render");
});

test("shows button", async () => {
  await renderContent("<button>Hello</button>"); // trace entry points here
});
```

## Retries and Repeats

Each attempt — retry or repeat — is recorded as a separate trace. When a test has multiple attempts, the viewer opens the most recent one by default. You can switch between attempts in the Report tab.

## Relation to Playwright Traces

`browser.traceView` and [`browser.trace`](/config/browser/trace) are independent features:

|                        | `browser.traceView`  | `browser.trace`                                |
| ---------------------- | -------------------- | ---------------------------------------------- |
| Viewer                 | Vitest UI (built-in) | Playwright Trace Viewer / trace.playwright.dev |
| Format                 | rrweb DOM snapshots  | Playwright `.trace.zip`                        |
| Requires external tool | No                   | Yes (`npx playwright show-trace`)              |

You can enable both at the same time. See [Playwright Trace Files](./trace-view-playwright.md) for the `browser.trace` workflow.
