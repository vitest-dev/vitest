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

## Example

::: tabs
== bottom
<center>
  <img alt="Vitest UI with details at the bottom" img-light src="/ui/light-ui-details-bottom.png">
  <img alt="Vitest UI with details at the bottom" img-dark src="/ui/dark-ui-details-bottom.png">
</center>
== right
<center>
  <img alt="Vitest UI with details at the right side" img-light src="/ui/light-ui-details-right.png">
  <img alt="Vitest UI with details at the right side" img-dark src="/ui/dark-ui-details-right.png">
</center>
:::
