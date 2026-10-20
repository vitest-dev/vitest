---
title: browser.traceView | Config
outline: deep
---

# browser.traceView <Version>5.0.0</Version>

- **Type:** `boolean | 'off' | 'on' | 'failure-only' | { enabled?: boolean; mode?: 'off' | 'on' | 'failure-only'; recordCanvas?: boolean; inlineImages?: boolean; ariaSnapshot?: boolean }`
- **CLI:** `--browser.traceView`
- **Default:** `false`

Enable [trace view](/guide/browser/trace-view) collection for browser tests. Vitest captures DOM snapshots for browser interactions and can show them in the browser UI, Vitest UI, or HTML reporter when those surfaces are enabled — no external tools required. When a test fails, the terminal output also includes a [timeline of its recorded steps](/guide/browser/trace-view#failure-output).

```ts
export default defineConfig({
  test: {
    browser: {
      traceView: true,
    },
  },
})
```

To keep traces only for failed tests, use the `'failure-only'` mode:

```ts
export default defineConfig({
  test: {
    browser: {
      traceView: 'failure-only',
    },
  },
})
```

Use the object form to enable additional snapshot fidelity options:

```ts
export default defineConfig({
  test: {
    browser: {
      traceView: {
        enabled: true,
        inlineImages: true,
        recordCanvas: true,
      },
    },
  },
})
```

| Option         | Default             | Description                                                                                         |
| -------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `enabled`      | `false`             | Enables Vitest trace-view artifact collection.                                                      |
| `mode`         | `'on'` when enabled | Which tests record trace-view artifacts: `'on'`, `'failure-only'`, or `'off'`.                      |
| `inlineImages` | `false`             | Inlines loaded `<img>` pixels into snapshots for more portable replay, useful in the HTML reporter. |
| `recordCanvas` | `false`             | Captures canvas pixels in snapshots.                                                                |
| `ariaSnapshot` | `true`              | Captures the accessibility tree alongside each snapshot.                                            |

## browser.traceView.enabled {#traceview-enabled}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.enabled`

Enables Vitest trace-view artifact collection.

## browser.traceView.mode <Version>5.1.0</Version> {#traceview-mode}

- **Type:** `'off' | 'on' | 'failure-only'`
- **Default:** `'on'` when `enabled` is `true`, otherwise `'off'`
- **CLI:** `--browser.traceView.mode <mode>`

Which tests record trace-view artifacts. Takes precedence over `enabled`.

- `'on'` records every test and sends each step as it happens, so Vitest UI can show tests live. Every step gets a snapshot.
- `'failure-only'` records every step in the browser and keeps the trace only for failed tests. A passing test sends nothing, so its overhead is close to zero. A failed test keeps its full step timeline with a single snapshot at the end of the test. Steps are not streamed, so Vitest UI shows a failed test's trace after the test finishes. Each retry is kept or dropped on its own.
- `'off'` disables trace view.

## browser.traceView.inlineImages {#traceview-inlineimages}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.inlineImages`

Inlines loaded `<img>` pixels into snapshots for more portable replay, useful in the HTML reporter.

## browser.traceView.recordCanvas {#traceview-recordcanvas}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.recordCanvas`

Captures canvas pixels in snapshots. This enables a weaker replay iframe sandbox because rrweb needs scripts to redraw canvas data.

## browser.traceView.ariaSnapshot <Version>5.1.0</Version> {#traceview-ariasnapshot}

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--browser.traceView.ariaSnapshot`

Captures the accessibility tree of the page alongside each snapshot. The trace viewer header can then switch from the DOM snapshot to an **Aria** view, which uses the same format as [aria snapshots](/guide/browser/aria-snapshots).

See [Trace View](/guide/browser/trace-view) for full documentation.
