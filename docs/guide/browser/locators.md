---
title: Locators | Browser Mode
outline: deep
---

# Locators <Version>2.x</Version> <!-- TODO when we decide on the release -->

## getByRole
## getByAltText
## getByLabelText
## getByPlaceholder
## getByTestId
## getByText
## getByTitle

## Methods

### click
### dblClick
### tripleClick
### clear
### hover
### unhover
### fill
### dropTo
### selectOptions
### screenshot

### element

- **Type:** `() => Element`

This method returns a single element matching the locator's selector.

If _no element_ matches the selector, an error is thrown. Consider using [`.query()`](#query) when you just need to check if the element exists.

If _multiple elements_ match the selector, an error is thrown. Use [`.elements()`](#elements) when you need all matching DOM Elements or [`.all()`](#all) if you need an array of locators matching the selector.

::: tip
This method can be useful if you need to pass it down to an external library. It is called automatically when locator is used with `expect.element` every time the assertion is [retried](/guide/browser/assertion-api):

```ts
await expect.element(page.getByRole('button')).toBeDisabled()
```
:::

Consider the following DOM structure:

```html
<div>Hello <span>World</span></div>
<div>Hello Germany</div>
<div>Hello</div>
```

These locators will not throw an error:

```ts
page.getByText('Hello World').element() // ✅
page.getByText('Hello Germany').element() // ✅
page.getByText('World').element() // ✅
page.getByText('Hello', { exact: true }).element() // ✅
```

These locators will throw an error:

```ts
// returns multiple elements
page.getByText('Hello').element() // ❌
page.getByText(/^Hello/).element() // ❌

// returns no elements
page.getByText('Hello USA').element() // ❌
```

### query
### elements
### all
