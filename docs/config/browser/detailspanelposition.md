---
title: browser.detailsPanelPosition | Config
outline: deep
---

# browser.detailsPanelPosition

- **Type:** `'right' | 'bottom'`
- **Default:** `'right'`
- **CLI:** `--browser.detailsPanelPosition=bottom`, `--browser.detailsPanelPosition=right`

Controls the default position of the details panel in the Vitest UI when running browser tests.

- `'right'` - Shows the details panel on the right side with a horizontal split between the browser viewport and the details panel.
- `'bottom'` - Shows the details panel at the bottom with a vertical split between the browser viewport and the details panel.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      detailsPanelPosition: 'bottom', // or 'right'
    },
  },
})
```
