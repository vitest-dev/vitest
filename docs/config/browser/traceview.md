---
title: browser.traceView | Config
outline: deep
---

# browser.traceView <Version>5.0.0</Version>

- **Type:** `boolean | 'off' | 'on' | 'failure-only' | { mode?: 'off' | 'on' | 'failure-only'; recordCanvas?: boolean; inlineImages?: boolean; ariaSnapshot?: boolean }`
- **CLI:** `--browser.traceView`
- **Default:** `'failure-only'`

Records the actions, assertions, and marks of browser tests with DOM snapshots, so you can replay them in the [trace viewer](/guide/browser/trace-view).

Set it to a [mode](#traceview-mode) such as `'failure-only'`, or use `true` and `false` as shorthands for `'on'` and `'off'`:

```ts
export default defineConfig({
  test: {
    browser: {
      traceView: true,
    },
  },
})
```

To combine a mode with the options below, use an object:

```ts
export default defineConfig({
  test: {
    browser: {
      traceView: {
        mode: 'on',
        inlineImages: true,
      },
    },
  },
})
```

## browser.traceView.mode <Version>5.1.0</Version> {#traceview-mode}

- **Type:** `'off' | 'on' | 'failure-only'`
- **Default:** `'failure-only'`
- **CLI:** `--browser.traceView.mode <mode>`

Sets which tests trace view records and what each trace keeps:

- `'failure-only'` records only failed tests. Each trace keeps every step and a snapshot of the page when the test failed.
- `'on'` records every test with a snapshot at each step, and Vitest UI shows the steps live as tests run.
- `'off'` records nothing.

## browser.traceView.inlineImages {#traceview-inlineimages}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.inlineImages`

Inlines loaded `<img>` pixels into snapshots, so the HTML report renders them without loading the original URLs. See [What Snapshots Capture](/guide/browser/trace-view#what-snapshots-capture) for details.

## browser.traceView.recordCanvas {#traceview-recordcanvas}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.recordCanvas`

Captures canvas pixels in snapshots. The trace viewer then allows scripts in its replay iframe for these traces. See the canvas replay sandbox warning in [What Snapshots Capture](/guide/browser/trace-view#what-snapshots-capture).

## browser.traceView.ariaSnapshot <Version>5.1.0</Version> {#traceview-ariasnapshot}

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--browser.traceView.ariaSnapshot`

Captures the accessibility tree of the page alongside each snapshot, so you can switch the trace viewer's snapshot pane between **DOM** and **Aria** views. The Aria view uses the same format as [aria snapshots](/guide/browser/aria-snapshots).

## browser.traceView.enabled <Deprecated /> {#traceview-enabled}

- **Type:** `boolean`
- **CLI:** `--browser.traceView.enabled`

Use [`mode`](#traceview-mode) instead. `true` is the same as `mode: 'on'`, and `false` is the same as `mode: 'off'`. When both are set, `mode` wins.
