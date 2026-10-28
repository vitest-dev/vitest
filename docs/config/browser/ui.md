---
title: browser.ui | Config
outline: deep
---

# browser.ui

- **Type:** `boolean`
- **Default:** `!browser.headless && !isCI`
- **CLI:** `--browser.ui=false`

Should the browser UI be injected into the page. By default, injects UI iframe during development. See [Headless Mode and UI](/guide/browser/#headless-mode-and-ui) for how this option relates to [`browser.headless`](/config/browser/headless) and the top-level [`--ui`](/guide/ui) flag.
