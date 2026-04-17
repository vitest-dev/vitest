---
title: browser.traceView | Config
outline: deep
---

# browser.traceView

- **Type:** `boolean | { enabled?: boolean; recordCanvas?: boolean; inlineImages?: boolean }`
- **CLI:** `--browser.traceView`
- **Default:** `false`

Enable trace-view collection for browser tests. Vitest captures DOM snapshots for browser interactions and can show them in the browser UI, Vitest UI, or HTML reporter when those surfaces are enabled — no external tools required.

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
        enabled: true,
        inlineImages: true,
        recordCanvas: true,
      },
    },
  },
})
```

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `false` | Enables Vitest trace-view artifact collection. |
| `inlineImages` | `false` | Inlines loaded `<img>` pixels into snapshots for more portable replay, especially in the HTML reporter. |
| `recordCanvas` | `false` | Captures readable canvas pixels in snapshots. This enables a weaker replay iframe sandbox because rrweb needs scripts to redraw canvas data. |

## browser.traceView.enabled {#traceview-enabled}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.enabled`

Enables Vitest trace-view artifact collection.

## browser.traceView.inlineImages {#traceview-inlineimages}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.inlineImages`

Inlines loaded `<img>` pixels into snapshots for more portable replay, especially in the HTML reporter.

## browser.traceView.recordCanvas {#traceview-recordcanvas}

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.traceView.recordCanvas`

Captures readable canvas pixels in snapshots. This enables a weaker replay iframe sandbox because rrweb needs scripts to redraw canvas data.

See [Trace View](/guide/browser/trace-view) for full documentation.
