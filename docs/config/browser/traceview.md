---
title: browser.traceView | Config
outline: deep
---

# browser.traceView <Version>5.0.0</Version>

- **Type:** `boolean | 'off' | 'on' | 'failure-only' | { mode?: 'off' | 'on' | 'failure-only'; recordCanvas?: boolean; inlineImages?: boolean; ariaSnapshot?: boolean }`
- **CLI:** `--browser.traceView`
- **Default:** `'failure-only'`

Enable [trace view](/guide/browser/trace-view) collection for browser tests. Vitest captures DOM snapshots for browser interactions and can show them in the browser UI, Vitest UI, or HTML reporter when those surfaces are enabled — no external tools required. When a test fails, the terminal output also includes a [timeline of its recorded steps](/guide/browser/trace-view#failure-output).

By default, trace view keeps traces only for failed tests. Set it to `true` to record every test, or `false` to turn it off:

```ts
export default defineConfig({
  test: {
    browser: {
      traceView: true,
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
        mode: 'on',
        inlineImages: true,
        recordCanvas: true,
      },
    },
  },
})
```

| Option         | Default          | Description                                                                                          |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| `mode`         | `'failure-only'` | How trace view records tests: `'on'` (every test), `'failure-only'` (only failed tests), or `'off'`. |
| `inlineImages` | `false`          | Inlines loaded `<img>` pixels into snapshots for more portable replay, useful in the HTML reporter.  |
| `recordCanvas` | `false`          | Captures canvas pixels in snapshots.                                                                 |
| `ariaSnapshot` | `true`           | Captures the accessibility tree alongside each snapshot.                                             |
| `enabled`      | `false`          | Deprecated. Use `mode` instead.                                                                      |

## browser.traceView.enabled <Deprecated /> {#traceview-enabled}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.enabled`

Use [`mode`](#traceview-mode) instead. `true` is the same as `mode: 'on'`.

## browser.traceView.mode <Version>5.1.0</Version> {#traceview-mode}

- **Type:** `'off' | 'on' | 'failure-only'`
- **Default:** `'failure-only'`
- **CLI:** `--browser.traceView.mode <mode>`

How trace view records tests. Takes precedence over the deprecated `enabled`.

- `'on'`: every test gets a trace with a snapshot at every step, and Vitest UI shows steps live as tests run.
- `'failure-only'`: only failed tests get a trace, with the full step timeline and a snapshot at the end.
- `'off'`: no traces.

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
