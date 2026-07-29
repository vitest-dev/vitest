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

## browser.locators.exact

- **Type:** `boolean`
- **Default:** `true`

When set to `true`, [locators](/api/browser/locators) match text exactly by default, requiring a full, case-sensitive match. Individual locator calls can override this default via their own `exact` option.

```ts
// With exact: true (default), this only matches the string "Hello, World" exactly.
// With exact: false, this matches "Hello, World!", "Say Hello, World", etc.
const locator = page.getByText('Hello, World', { exact: true })
await locator.click()
```

## browser.locators.errorFormat <Version>5.0.0</Version> {#browser-locators-errorformat}

- **Type:** `'html' | 'aria' | 'all'`
- **Default:** `'all'`

Controls what Vitest prints when a locator cannot find an element. Vitest prints information for the DOM subtree where the locator search ran, or `document.body` for page-level locators.

- `'html'` prints that DOM subtree as HTML using [`utils.prettyDOM`](/api/browser/context#prettydom).
- `'aria'` prints that DOM subtree as an [ARIA snapshot](/guide/browser/aria-snapshots), which focuses on accessible roles, names, and state.
- `'all'` prints the ARIA snapshot first, followed by the HTML output.

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

For example, `all` displays a following error:

```html
VitestBrowserElementError: Cannot find element with locator: getByRole('button', { name: 'Save' })

ARIA tree:
- main:
  - heading "Settings" [level=1]
  - button "Cancel"

HTML:
<body>
  <main>
    <h1>
      Settings
    </h1>
    <button>
      Cancel
    </button>
  </main>
</body>
```
