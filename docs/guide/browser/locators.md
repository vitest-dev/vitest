---
title: Locators | Browser Mode
outline: [2, 3]
---

# Locators <Version>2.1.0</Version>

A locator is a representation of an element or a number of elements. Every locator is defined by a string called a selector. Vitest abstracts this selector by providing convenient methods that generate those selectors behind the scenes.

The locator API uses a fork of [Playwright's locators](https://playwright.dev/docs/api/class-locator) called [Ivya](https://npmjs.com/ivya). However, Vitest provides this API to every [provider](/guide/browser/config.html#browser-provider).

## getByRole

```ts
function getByRole(
  role: ARIARole | string,
  options?: LocatorByRoleOptions,
): Locator
```

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

##### Options

- `exact: boolean`

  Whether the `name` is matched exactly: case-sensitive and whole-string. Disabled by default. This option is ignored if `name` is a regular expression. Note that exact match still trims whitespace.

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

##### See also

- [List of ARIA roles at MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles)
- [List of ARIA roles at w3.org](https://www.w3.org/TR/wai-aria-1.2/#role_definitions)
- [testing-library's `ByRole`](https://testing-library.com/docs/queries/byrole/)

## getByAltText

```ts
function getByAltText(
  text: string | RegExp,
  options?: LocatorOptions,
): Locator
```

Creates a locator capable of finding an element with an `alt` attribute that matches the text. Unlike testing-library's implementation, Vitest will match any element that has a matching `alt` attribute.

```tsx
<img alt="Incredibles 2 Poster" src="/incredibles-2.png" />

page.getByAltText(/incredibles.*? poster/i) // ✅
page.getByAltText('non existing alt text') // ❌
```

#### Options

- `exact: boolean`

  Whether the `text` is matched exactly: case-sensitive and whole-string. Disabled by default. This option is ignored if `text` is a regular expression. Note that exact match still trims whitespace.

#### See also

- [testing-library's `ByAltText`](https://testing-library.com/docs/queries/byalttext/)

## getByLabelText

```ts
function getByLabelText(
  text: string | RegExp,
  options?: LocatorOptions,
): Locator
```

Creates a locator capable of finding an element that has an associated label.

The `page.getByLabelText('Username')` locator will find every input in the example bellow:

```html
// for/htmlFor relationship between label and form element id
<label for="username-input">Username</label>
<input id="username-input" />

// The aria-labelledby attribute with form elements
<label id="username-label">Username</label>
<input aria-labelledby="username-label" />

// Wrapper labels
<label>Username <input /></label>

// Wrapper labels where the label text is in another child element
<label>
  <span>Username</span>
  <input />
</label>

// aria-label attributes
// Take care because this is not a label that users can see on the page,
// so the purpose of your input must be obvious to visual users.
<input aria-label="Username" />
```

#### Options

- `exact: boolean`

  Whether the `text` is matched exactly: case-sensitive and whole-string. Disabled by default. This option is ignored if `text` is a regular expression. Note that exact match still trims whitespace.

#### See also

- [testing-library's `ByLabelText`](https://testing-library.com/docs/queries/bylabeltext/)

## getByPlaceholder

```ts
function getByPlaceholder(
  text: string | RegExp,
  options?: LocatorOptions,
): Locator
```

Creates a locator capable of finding an element that has the specified `placeholder` attribute. Vitest will match any element that has a matching `placeholder` attribute, not just `input`.

```tsx
<input placeholder="Username" />

page.getByPlaceholder('Username') // ✅
page.getByPlaceholder('not found') // ❌
```

::: warning
It is generally better to rely on a label using [`getByLabelText`](#getbylabeltext) than a placeholder.
:::

#### Options

- `exact: boolean`

  Whether the `text` is matched exactly: case-sensitive and whole-string. Disabled by default. This option is ignored if `text` is a regular expression. Note that exact match still trims whitespace.

#### See also

- [testing-library's `ByPlaceholderText`](https://testing-library.com/docs/queries/byplaceholdertext/)

## getByText

```ts
function getByText(
  text: string | RegExp,
  options?: LocatorOptions,
): Locator
```

Creates a locator capable of finding an element that contains the specified text. The text will be matched against TextNode's [`nodeValue`](https://developer.mozilla.org/en-US/docs/Web/API/Node/nodeValue) or input's value if the type is `button` or `reset`. Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.

```tsx
<a href="/about">About ℹ️</a>

page.getByText(/about/i) // ✅
page.getByText('about', { exact: true }) // ❌
```

::: tip
This locator is useful for locating non-interactive elements. If you need to locate an interactive element, like a button or an input, prefer [`getByRole`](#getbyrole).
:::

#### Options

- `exact: boolean`

  Whether the `text` is matched exactly: case-sensitive and whole-string. Disabled by default. This option is ignored if `text` is a regular expression. Note that exact match still trims whitespace.

#### See also

- [testing-library's `ByText`](https://testing-library.com/docs/queries/bytext/)

## getByTitle

```ts
function getByTitle(
  text: string | RegExp,
  options?: LocatorOptions,
): Locator
```

Creates a locator capable of finding an element that has the specified `title` attribute. Unlike testing-library's `getByTitle`, Vitest cannot find `title` elements within an SVG.

```tsx
<span title="Delete" id="2"></span>

page.getByTitle('Delete') // ✅
page.getByTitle('Create') // ❌
```

#### Options

- `exact: boolean`

  Whether the `text` is matched exactly: case-sensitive and whole-string. Disabled by default. This option is ignored if `text` is a regular expression. Note that exact match still trims whitespace.

#### See also

- [testing-library's `ByTitle`](https://testing-library.com/docs/queries/bytitle/)

## getByTestId

```ts
function getByTestId(text: string | RegExp): Locator
```

Creates a locator capable of finding an element that matches the specified test id attribute. You can configure the attribute name with [`browser.locators.testIdAttribute`](/guide/browser/config#browser-locators-testidattribute).

```tsx
<div data-testid="custom-element" />

page.getByTestId('custom-element') // ✅
page.getByTestId('non-existing-element') // ❌
```

::: warning
It is recommended to use this only after the other locators don't work for your use case. Using `data-testid` attributes does not resemble how your software is used and should be avoided if possible.
:::

#### Options

- `exact: boolean`

  Whether the `text` is matched exactly: case-sensetive and whole-string. Disabled by default. This option is ignored if `text` is a regular expression. Note that exact match still trims whitespace.

#### See also

- [testing-library's `ByTestId`](https://testing-library.com/docs/queries/bytestid/)

## nth

```ts
function nth(index: number): Locator
```

This method returns a new locator that matches only a specific index within a multi-element query result. It's zero based, `nth(0)` selects the first element. Unlike `elements()[n]`, the `nth` locator will be retried until the element is present.

```html
<div aria-label="one"><input/><input/><input/></div>
<div aria-label="two"><input/></div>
```

```tsx
page.getByRole('textbox').nth(0) // ✅
page.getByRole('textbox').nth(4) // ❌
```

::: tip
Before resorting to `nth`, you may find it useful to use chained locators to narrow down your search.
Sometimes there is no better way to distinguish than by element position; although this can lead to flake, it's better than nothing.
:::

```tsx
page.getByLabel('two').getByRole('input') // ✅ better alternative to page.getByRole('textbox').nth(3)
page.getByLabel('one').getByRole('input') // ❌ too ambiguous
page.getByLabel('one').getByRole('input').nth(1) // ✅ pragmatic compromise
```

## first

```ts
function first(): Locator
```

This method returns a new locator that matches only the first index of a multi-element query result.
It is sugar for `nth(0)`.

```html
<input/> <input/> <input/>
```

```tsx
page.getByRole('textbox').first() // ✅
```

## last

```ts
function last(): Locator
```

This method returns a new locator that matches only the last index of a multi-element query result.
It is sugar for `nth(-1)`.

```html
<input/> <input/> <input/>
```

```tsx
page.getByRole('textbox').last() // ✅
```

## Methods

All methods are asynchronous and must be awaited. Since Vitest 3, tests will fail if a method is not awaited.

### click

```ts
function click(options?: UserEventClickOptions): Promise<void>
```

Click on an element. You can use the options to set the cursor position.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).click()
```

- [See more at `userEvent.click`](/guide/browser/interactivity-api#userevent-click)

### dblClick

```ts
function dblClick(options?: UserEventDoubleClickOptions): Promise<void>
```

Triggers a double click event on an element. You can use the options to set the cursor position.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).dblClick()
```

- [See more at `userEvent.dblClick`](/guide/browser/interactivity-api#userevent-dblclick)

### tripleClick

```ts
function tripleClick(options?: UserEventTripleClickOptions): Promise<void>
```

Triggers a triple click event on an element. Since there is no `tripleclick` in browser api, this method will fire three click events in a row.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).tripleClick()
```

- [See more at `userEvent.tripleClick`](/guide/browser/interactivity-api#userevent-tripleclick)

### clear

```ts
function clear(): Promise<void>
```

Clears the input element content.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('textbox', { name: 'Full Name' }).clear()
```

- [See more at `userEvent.clear`](/guide/browser/interactivity-api#userevent-clear)

### hover

```ts
function hover(options?: UserEventHoverOptions): Promise<void>
```

Moves the cursor position to the selected element.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).hover()
```

- [See more at `userEvent.hover`](/guide/browser/interactivity-api#userevent-hover)

### unhover

```ts
function unhover(options?: UserEventHoverOptions): Promise<void>
```

This works the same as [`locator.hover`](#hover), but moves the cursor to the `document.body` element instead.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('img', { name: 'Rose' }).unhover()
```

- [See more at `userEvent.unhover`](/guide/browser/interactivity-api#userevent-unhover)

### fill

```ts
function fill(text: string, options?: UserEventFillOptions): Promise<void>
```

Sets the value of the current `input`, `textarea` or `conteneditable` element.

```ts
import { page } from '@vitest/browser/context'

await page.getByRole('input', { name: 'Full Name' }).fill('Mr. Bean')
```

- [See more at `userEvent.fill`](/guide/browser/interactivity-api#userevent-fill)

### dropTo

```ts
function dropTo(
  target: Locator,
  options?: UserEventDragAndDropOptions,
): Promise<void>
```

Drags the current element to the target location.

```ts
import { page } from '@vitest/browser/context'

const paris = page.getByText('Paris')
const france = page.getByText('France')

await paris.dropTo(france)
```

- [See more at `userEvent.dragAndDrop`](/guide/browser/interactivity-api#userevent-draganddrop)

### selectOptions

```ts
function selectOptions(
  values:
    | HTMLElement
    | HTMLElement[]
    | Locator
    | Locator[]
    | string
    | string[],
  options?: UserEventSelectOptions,
): Promise<void>
```

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

```ts
function screenshot(options: LocatorScreenshotOptions & { base64: true }): Promise<{
  path: string
  base64: string
}>
function screenshot(options?: LocatorScreenshotOptions & { base64?: false }): Promise<string>
```

Creates a screenshot of the element matching the locator's selector.

You can specify the save location for the screenshot using the `path` option, which is relative to the current test file. If the `path` option is not set, Vitest will default to using [`browser.screenshotDirectory`](/guide/browser/config#browser-screenshotdirectory) (`__screenshot__` by default), along with the names of the file and the test to determine the screenshot's filepath.

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

```ts
function query(): Element | null
```

This method returns a single element matching the locator's selector or `null` if no element is found.

If multiple elements match the selector, this method will throw an error.  Use [`.elements()`](#elements) when you need all matching DOM Elements or [`.all()`](#all) if you need an array of locators matching the selector.

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

```ts
function element(): Element
```

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

```ts
function elements(): Element[]
```

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

```ts
function all(): Locator[]
```

This method returns an array of new locators that match the selector.

Internally, this method calls `.elements` and wraps every element using [`page.elementLocator`](/guide/browser/context#page).

- [See `locator.elements()`](#elements)

## Properties

### selector

The `selector` is a string that will be used to locate the element by the browser provider. Playwright will use a `playwright` locator syntax while `preview` and `webdriverio` will use CSS.

::: danger
You should not use this string in your test code. The `selector` string should only be used when working with the Commands API:

```ts [commands.ts]
import type { BrowserCommand } from 'vitest/node'

const test: BrowserCommand<string> = function test(context, selector) {
  // playwright
  await context.iframe.locator(selector).click()
  // webdriverio
  await context.browser.$(selector).click()
}
```

```ts [example.test.ts]
import { test } from 'vitest'
import { commands, page } from '@vitest/browser/context'

test('works correctly', async () => {
  await commands.test(page.getByText('Hello').selector) // ✅
  // vitest will automatically unwrap it to a string
  await commands.test(page.getByText('Hello')) // ✅
})
```
:::
