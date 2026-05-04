---
title: browser.locators | Config
outline: deep
---

# browser.locators

Options for built-in [browser locators](/api/browser/locators).

## browser.locators.testIdAttribute

- **Type:** `string`
- **Default:** `data-testid`

Attribute used to find elements with `getByTestId` locator.

## browser.locators.exact <Version type="experimental">4.1.3</Version> {#browser-locators-exact}

- **Type:** `boolean`
- **Default:** `false`

When set to `true`, [locators](/api/browser/locators) will match text exactly by default, requiring a full, case-sensitive match. Individual locator calls can override this default via their own `exact` option.

```ts
// With exact: false (default), this matches "Hello, World!", "Say Hello, World", etc.
// With exact: true, this only matches the string "Hello, World" exactly.
const locator = page.getByText('Hello, World', { exact: true })
await locator.click()
```

## browser.locators.errorFormat <Version>5.0.0</Version> {#browser-locators-errorformat}

- **Type:** `'html' | 'aria' | 'both'`
- **Default:** `'html'`

Controls what Vitest prints when a locator cannot find an element. Vitest prints information for the DOM subtree where the locator search ran, or `document.body` for page-level locators.

- `'html'` prints that DOM subtree as HTML using [`utils.prettyDOM`](/api/browser/context#prettydom).
- `'aria'` prints that DOM subtree as an [ARIA snapshot](/guide/browser/aria-snapshots), which focuses on accessible roles, names, and state.
- `'both'` prints the ARIA snapshot first, followed by the HTML output.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      locators: {
        errorFormat: 'aria',
      },
    },
  },
})
```
