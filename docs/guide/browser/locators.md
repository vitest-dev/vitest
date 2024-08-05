---
title: Locators | Browser Mode
outline: deep
---

# Locators <Version>2.1.0</Version>

A locator is a representation of an element or a number of elements. Every locator is defined by a string called a selector. Vitest abstracts this selector by providing convenient methods that generate those selectors behind the scenes.

The locator API uses a fork of [Playwright's locators](https://playwright.dev/docs/api/class-locator) called [Ivya](https://npmjs.com/ivya). However, Vitest provides this API to every [provider](/guide/browser/#provider-configuration).

## getByRole

- **Type:** `(role: ARIARole | string, options?: LocatorByRoleOptions) => Locator`

Creates a way to locate an element by its [ARIA role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles), [ARIA attributes](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes) and [accessible name](https://developer.mozilla.org/en-US/docs/Glossary/Accessible_name).

::: tip
If you only query for a single element with `getByText('The name')` it's oftentimes better to use `getByRole(expectedRole, { name: 'The name' })`. The accessible name query does not replace other queries such as `*ByAltText` or `*ByTitle`. While the accessible name can be equal to these attributes, it does not replace the functionality of these attributes.
:::

Consider the following DOM structure.

```html
<h3>Sign up</h3>
<label>
  Login
  <input type="text" />
</label>
<label>
  Password
  <input type="password" />
</label>
<br/>
<button>Submit</button>
```

You can locate each element by its implicit role:

```ts
await expect.element(
  page.getByRole('heading', { name: 'Sign up' })
).toBeVisible()

await page.getByRole('textbox', { name: 'Login' }).fill('admin')
await page.getByRole('textbox', { name: 'Password' }).fill('admin')

await page.getByRole('button', { name: /submit/i }).click()
```

::: warning
Roles are matched by string equality, without inheriting from the ARIA role hierarchy. As a result, querying a superclass role like `checkbox` will not include elements with a subclass role like `switch`.

By default, many semantic elements in HTML have a role; for example, `<input type="radio">` has the "radio" role. Non-semantic elements in HTML do not have a role; `<div>` and `<span>` without added semantics return `null`. The `role` attribute can provide semantics.

Providing roles via `role` or `aria-*` attributes to built-in elements that already have an implicit role is **highly discouraged** by ARIA guidelines.
:::

### Options

- `exact: boolean`

  Whether the `name` is matched exactly: case-sensetive and whole-string. Disabled by default. This option is ignored if `name` is a regular expression. Note that exact match still trims whitespace.

  ```tsx
  <button>Hello World</button>

  page.getByRole('button', { name: 'hello world' }) // ✅
  page.getByRole('button', { name: 'hello world', exact: true }) // ❌
  page.getByRole('button', { name: 'Hello World', exact: true }) // ✅
  ```

- `checked: boolean`

  Should checked elements (set by `aria-checked` or `<input type="checkbox"/>`) be included or not. By default, the filter is not applied.

  See [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked) for more information

  ```tsx
  <>
    <button role="checkbox" aria-checked="true" />
    <input type="checkbox" checked />
  </>

  page.getByRole('checkbox', { checked: true }) // ✅
  page.getByRole('checkbox', { checked: false }) // ❌
  ```

- `disabled: boolean`

  Should disabled elements be included or not. By default, the filter is not applied. Note that unlike other attributes, `disable` state is inherited.

  See [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled) for more information

  ```tsx
  <input type="text" disabled />

  page.getByRole('textbox', { disabled: true }) // ✅
  page.getByRole('textbox', { disabled: false }) // ❌
  ```

- `expanded: boolean`

  Should expanded elements be included or not. By default, the filter is not applied.

  See [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded) for more information

  ```tsx
  <a aria-expanded="true" href="example.com">Link</a>

  page.getByRole('link', { expanded: true }) // ✅
  page.getByRole('link', { expanded: false }) // ❌
  ```

- `includeHidden: boolean`

  Should elements that are [normally excluded](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion) from the accessibility tree be queried. By default, only non-hidden elements are matched by role selector.

  Note that roles `none` and `presentation` are always included.

  ```tsx
  <button style="display: none" />

  page.getByRole('button') // ❌
  page.getByRole('button', { includeHidden: false }) // ❌
  page.getByRole('button', { includeHidden: true }) // ✅
  ```

- `level: number`

  A number attribute that is usually present for `heading`, `listitem`, `row`, `treeitem` roles with default values for `<h1>-<h6>` elements. By default, the filter is not applied.

  See [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level) for more information

  ```tsx
  <>
    <h1>Heading Level One</h1>
    <div role="heading" aria-level="1">Second Heading Level One</div>
  </>

  page.getByRole('heading', { level: 1 }) // ✅
  page.getByRole('heading', { level: 2 }) // ❌
  ```

- `name: string | RegExp`

  [An accessible name](https://developer.mozilla.org/en-US/docs/Glossary/Accessible_name). By default, matching is case-insensitive and searches for a substring. Use `exact` option to control this behavior.

  ```tsx
  <button>Click Me!</button>

  page.getByRole('button', { name: 'Click Me!' }) // ✅
  page.getByRole('button', { name: 'click me!' }) // ✅
  page.getByRole('button', { name: 'Click Me?' }) // ❌
  ```

- `pressed: boolean`

  Should pressed elements be included or not. By default, the filter is not applied.

  See [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed) for more information

  ```tsx
  <button aria-pressed="true">👍</button>

  page.getByRole('button', { pressed: true }) // ✅
  page.getByRole('button', { pressed: false }) // ❌
  ```

- `selected: boolean`

  Should selected elements be included or not. By default, the filter is not applied.

  See [`aria-selected`](https://www.w3.org/TR/wai-aria-1.2/#aria-selected) for more information

  ```tsx
  <button role="tab" aria-selected="true">Vue</button>

  page.getByRole('button', { selected: true }) // ✅
  page.getByRole('button', { selected: false }) // ❌
  ```

### See also

- [List of ARIA roles at MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
- [List of ARIA roles at w3.org](https://www.w3.org/TR/wai-aria-1.2/#role_definitions)
- [testing-library's `ByRole`](https://testing-library.com/docs/queries/byrole/)

## getByAltText
## getByLabelText
## getByPlaceholder
## getByTestId
## getByText
## getByTitle

## Methods

### click

- **Type:** `(options?: UserEventClickOptions) => Promise<void>`

Click on an element. You can use the options to set the cursor position.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).click()
```

- [See more at `userEvent.click`](/guide/browser/interactivity-api#userevent-click)

### dblClick

- **Type:** `(options?: UserEventClickOptions) => Promise<void>`

Triggers a double click event on an element. You can use the options to set the cursor position.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).dblClick()
```

- [See more at `userEvent.dblClick`](/guide/browser/interactivity-api#userevent-dblclick)

### tripleClick

- **Type:** `(options?: UserEventClickOptions) => Promise<void>`

Triggers a triple click event on an element. Since there is no `tripleclick` in browser api, this method will fire three click events in a row.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).tripleClick()
```

- [See more at `userEvent.tripleClick`](/guide/browser/interactivity-api#userevent-tripleclick)

### clear

- **Type:** `() => Promise<void>`

Clears the input element content.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('textbox', { name: 'Full Name' }).clear()
```

- [See more at `userEvent.clear`](/guide/browser/interactivity-api#userevent-clear)

### hover

- **Type:** `(options?: UserEventHoverOptions) => Promise<void>`

Moves the cursor position to the selected element.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).hover()
```

- [See more at `userEvent.hover`](/guide/browser/interactivity-api#userevent-hover)

### unhover

- **Type:** `(options?: UserEventHoverOptions) => Promise<void>`

This works the same as [`locator.hover`](#hover), but moves the cursor to the `document.body` element instead.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).unhover()
```

- [See more at `userEvent.unhover`](/guide/browser/interactivity-api#userevent-unhover)

### fill

- **Type:** `(text: string, options?: UserEventFillOptions) => Promise<void>`

Sets the value of the current `input`, `textarea` or `conteneditable` element.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('input', { name: 'Full Name' }).fill('Mr. Bean')
```

- [See more at `userEvent.fill`](/guide/browser/interactivity-api#userevent-fill)

### dropTo

- **Type:** `(target: Locator, options?: UserEventDragAndDropOptions) => Promise<void>`

Drags the current element to the target location.

```ts
import { page } from '@vitest/browser/context'

const paris = page.getByText('Paris')
const france = page.getByText('France')

await paris.dropTo(france)
```

- [See more at `userEvent.dragAndDrop`](/guide/browser/interactivity-api#userevent-draganddrop)

### selectOptions

- **Type:** `(values: HTMLElement | HTMLElement[] | string | string[], options?: UserEventSelectOptions) => Promise<void>`

Choose one or more values from a `<select>` element.

```ts
import { page } from '@vitest/browser/context'

const languages = page.getByRole('select', { name: 'Languages' })

await languages.selectOptions('EN')
await languages.selectOptions(['ES', 'FR'])
await languages.selectOptions([
  languages.getByRole('option', { name: 'Spanish' }),
  languages.getByRole('option', { name: 'French' }),
])
```

- [See more at `userEvent.selectOptions`](/guide/browser/interactivity-api#userevent-selectoptions)

### screenshot

- **Type:** `(options?: LocatorScreenshotOptions) => Promise<string | { path: string; base64: string }>`

Creates a screenshot of the element matching the locator's selector.

You can specify the save location for the screenshot using the `path` option, which is relative to the current test file. If the `path` option is not set, Vitest will default to using [`browser.screenshotDirectory`](/config/#browser-screenshotdirectory) (`__screenshot__` by default), along with the names of the file and the test to determine the screenshot's filepath.

If you also need the content of the screenshot, you can specify `base64: true` to return it alongside the filepath where the screenshot is saved.

```ts
import { page } from '@vitest/browser/context'

const button = page.getByRole('button', { name: 'Click Me!' })

const path = await button.screenshot()

const { path, base64 } = await button.screenshot({
  path: './button-click-me.png',
  base64: true, // also return base64 string
})
// path - fullpath to the screenshot
// bas64 - base64 encoded string of the screenshot
```

### query

- **Type:** `() => Element | null`

This method returns a single element matching the locator's selector or `null` if no element is found.

If multilple elements match the selector, this method will throw an error.  Use [`.elements()`](#elements) when you need all matching DOM Elements or [`.all()`](#all) if you need an array of locators matching the selector.

Consider the following DOM structure:

```html
<div>Hello <span>World</span></div>
<div>Hello</div>
```

These locators will not throw an error:

```ts
page.getByText('Hello World').query() // ✅ HTMLDivElement
page.getByText('Hello Germany').query() // ✅ null
page.getByText('World').query() // ✅ HTMLSpanElement
page.getByText('Hello', { exact: true }).query() // ✅ HTMLSpanElement
```

These locators will throw an error:

```ts
// returns multiple elements
page.getByText('Hello').query() // ❌
page.getByText(/^Hello/).query() // ❌
```

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

### elements

- **Type:** `() => Element[]`

This method returns an array of elements matching the locator's selector.

This function never throws an error. If there are no elements matching the selector, this method will return an empty array.

Consider the following DOM structure:

```html
<div>Hello <span>World</span></div>
<div>Hello</div>
```

These locators will always succeed:

```ts
page.getByText('Hello World').elements() // ✅ [HTMLElement]
page.getByText('World').elements() // ✅ [HTMLElement]
page.getByText('Hello', { exact: true }).elements() // ✅ [HTMLElement]
page.getByText('Hello').element() // ✅ [HTMLElement, HTMLElement]
page.getByText('Hello USA').elements() // ✅ []
```

### all

- **Type:** `() => Locator[]`

This method returns an array of new locators that match the selector.

Internally, this method calls `.elements` and wraps every element using [`page.elementLocator`](/guide/browser/context#page).

- [See `locator.elements()`](#elements)
