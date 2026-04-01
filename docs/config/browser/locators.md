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
