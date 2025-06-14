---
title: Assertion API | Browser Mode
---

# Assertion API

Vitest provides a wide range of DOM assertions out of the box forked from [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom) library with the added support for locators and built-in retry-ability.

::: tip TypeScript Support
If you are using [TypeScript](/guide/browser/#typescript) or want to have correct type hints in `expect`, make sure you have `@vitest/browser/context` referenced somewhere. If you never imported from there, you can add a `reference` comment in any file that's covered by your `tsconfig.json`:

```ts
/// <reference types="@vitest/browser/context" />
```
:::

Tests in the browser might fail inconsistently due to their asynchronous nature. Because of this, it is important to have a way to guarantee that assertions succeed even if the condition is delayed (by a timeout, network request, or animation, for example). For this purpose, Vitest provides retriable assertions out of the box via the [`expect.poll`](/api/expect#poll) and `expect.element` APIs:

```ts
import { expect, test } from 'vitest'
import { page } from '@vitest/browser/context'

test('error banner is rendered', async () => {
  triggerError()

  // This creates a locator that will try to find the element
  // when any of its methods are called.
  // This call by itself doesn't check the existence of the element.
  const banner = page.getByRole('alert', {
    name: /error/i,
  })

  // Vitest provides `expect.element` with built-in retry-ability
  // It will repeatedly check that the element exists in the DOM and that
  // the content of `element.textContent` is equal to "Error!"
  // until all the conditions are met
  await expect.element(banner).toHaveTextContent('Error!')
})
```

We recommend to always use `expect.element` when working with `page.getBy*` locators to reduce test flakiness. Note that `expect.element` accepts a second option:

```ts
interface ExpectPollOptions {
  // The interval to retry the assertion for in milliseconds
  // Defaults to "expect.poll.interval" config option
  interval?: number
  // Time to retry the assertion for in milliseconds
  // Defaults to "expect.poll.timeout" config option
  timeout?: number
  // The message printed when the assertion fails
  message?: string
}
```

::: tip
`expect.element` is a shorthand for `expect.poll(() => element)` and works in exactly the same way.

`toHaveTextContent` and all other assertions are still available on a regular `expect` without a built-in retry-ability mechanism:

```ts
// will fail immediately if .textContent is not `'Error!'`
expect(banner).toHaveTextContent('Error!')
```
:::

## toBeDisabled

```ts
function toBeDisabled(): Promise<void>
```

Allows you to check whether an element is disabled from the user's perspective.

Matches if the element is a form control and the `disabled` attribute is specified on this element or the
element is a descendant of a form element with a `disabled` attribute.

Note that only native control elements such as HTML `button`, `input`, `select`, `textarea`, `option`, `optgroup`
can be disabled by setting "disabled" attribute. "disabled" attribute on other elements is ignored, unless it's a custom element.

```html
<button
  data-testid="button"
  type="submit"
  disabled
>
  submit
</button>
```

```ts
await expect.element(getByTestId('button')).toBeDisabled() // ✅
await expect.element(getByTestId('button')).not.toBeDisabled() // ❌
```

## toBeEnabled

```ts
function toBeEnabled(): Promise<void>
```

Allows you to check whether an element is not disabled from the user's perspective.

Works like [`not.toBeDisabled()`](#tobedisabled). Use this matcher to avoid double negation in your tests.

```html
<button
  data-testid="button"
  type="submit"
  disabled
>
  submit
</button>
```

```ts
await expect.element(getByTestId('button')).toBeEnabled() // ✅
await expect.element(getByTestId('button')).not.toBeEnabled() // ❌
```

## toBeEmptyDOMElement

```ts
function toBeEmptyDOMElement(): Promise<void>
```

This allows you to assert whether an element has no visible content for the user. It ignores comments but will fail if the element contains white-space.

```html
<span data-testid="not-empty"><span data-testid="empty"></span></span>
<span data-testid="with-whitespace"> </span>
<span data-testid="with-comment"><!-- comment --></span>
```

```ts
await expect.element(getByTestId('empty')).toBeEmptyDOMElement()
await expect.element(getByTestId('not-empty')).not.toBeEmptyDOMElement()
await expect.element(
  getByTestId('with-whitespace')
).not.toBeEmptyDOMElement()
```

## toBeInTheDocument

```ts
function toBeInTheDocument(): Promise<void>
```

Assert whether an element is present in the document or not.

```html
<svg data-testid="svg-element"></svg>
```

```ts
await expect.element(getByTestId('svg-element')).toBeInTheDocument()
await expect.element(getByTestId('does-not-exist')).not.toBeInTheDocument()
```

::: warning
This matcher does not find detached elements. The element must be added to the document to be found by `toBeInTheDocument`. If you desire to search in a detached element, please use: [`toContainElement`](#tocontainelement).
:::

## toBeInvalid

```ts
function toBeInvalid(): Promise<void>
```

This allows you to check if an element, is currently invalid.

An element is invalid if it has an [`aria-invalid` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) with no value or a value of `"true"`, or if the result of [`checkValidity()`](https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation) is `false`.

```html
<input data-testid="no-aria-invalid" />
<input data-testid="aria-invalid" aria-invalid />
<input data-testid="aria-invalid-value" aria-invalid="true" />
<input data-testid="aria-invalid-false" aria-invalid="false" />

<form data-testid="valid-form">
  <input />
</form>

<form data-testid="invalid-form">
  <input required />
</form>
```

```ts
await expect.element(getByTestId('no-aria-invalid')).not.toBeInvalid()
await expect.element(getByTestId('aria-invalid')).toBeInvalid()
await expect.element(getByTestId('aria-invalid-value')).toBeInvalid()
await expect.element(getByTestId('aria-invalid-false')).not.toBeInvalid()

await expect.element(getByTestId('valid-form')).not.toBeInvalid()
await expect.element(getByTestId('invalid-form')).toBeInvalid()
```

## toBeRequired

```ts
function toBeRequired(): Promise<void>
```

This allows you to check if a form element is currently required.

An element is required if it is having a `required` or `aria-required="true"` attribute.

```html
<input data-testid="required-input" required />
<input data-testid="aria-required-input" aria-required="true" />
<input data-testid="conflicted-input" required aria-required="false" />
<input data-testid="aria-not-required-input" aria-required="false" />
<input data-testid="optional-input" />
<input data-testid="unsupported-type" type="image" required />
<select data-testid="select" required></select>
<textarea data-testid="textarea" required></textarea>
<div data-testid="supported-role" role="tree" required></div>
<div data-testid="supported-role-aria" role="tree" aria-required="true"></div>
```

```ts
await expect.element(getByTestId('required-input')).toBeRequired()
await expect.element(getByTestId('aria-required-input')).toBeRequired()
await expect.element(getByTestId('conflicted-input')).toBeRequired()
await expect.element(getByTestId('aria-not-required-input')).not.toBeRequired()
await expect.element(getByTestId('optional-input')).not.toBeRequired()
await expect.element(getByTestId('unsupported-type')).not.toBeRequired()
await expect.element(getByTestId('select')).toBeRequired()
await expect.element(getByTestId('textarea')).toBeRequired()
await expect.element(getByTestId('supported-role')).not.toBeRequired()
await expect.element(getByTestId('supported-role-aria')).toBeRequired()
```

## toBeValid

```ts
function toBeValid(): Promise<void>
```

This allows you to check if the value of an element, is currently valid.

An element is valid if it has no [`aria-invalid` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) or an attribute value of "false". The result of [`checkValidity()`](https://developer.mozilla.org/en-US/docs/Web/HTML/Constraint_validation) must also be `true` if it's a form element.

```html
<input data-testid="no-aria-invalid" />
<input data-testid="aria-invalid" aria-invalid />
<input data-testid="aria-invalid-value" aria-invalid="true" />
<input data-testid="aria-invalid-false" aria-invalid="false" />

<form data-testid="valid-form">
  <input />
</form>

<form data-testid="invalid-form">
  <input required />
</form>
```

```ts
await expect.element(getByTestId('no-aria-invalid')).toBeValid()
await expect.element(getByTestId('aria-invalid')).not.toBeValid()
await expect.element(getByTestId('aria-invalid-value')).not.toBeValid()
await expect.element(getByTestId('aria-invalid-false')).toBeValid()

await expect.element(getByTestId('valid-form')).toBeValid()
await expect.element(getByTestId('invalid-form')).not.toBeValid()
```

## toBeVisible

```ts
function toBeVisible(): Promise<void>
```

This allows you to check if an element is currently visible to the user.

Element is considered visible when it has non-empty bounding box and does not have `visibility:hidden` computed style.

Note that according to this definition:

- Elements of zero size **are not** considered visible.
- Elements with `display:none` **are not** considered visible.
- Elements with `opacity:0` **are** considered visible.

To check that at least one element from the list is visible, use `locator.first()`.

```ts
// A specific element is visible.
await expect.element(page.getByText('Welcome')).toBeVisible()

// At least one item in the list is visible.
await expect.element(page.getByTestId('todo-item').first()).toBeVisible()

// At least one of the two elements is visible, possibly both.
await expect.element(
  page.getByRole('button', { name: 'Sign in' })
    .or(page.getByRole('button', { name: 'Sign up' }))
    .first()
).toBeVisible()
```

## toContainElement

```ts
function toContainElement(element: HTMLElement | SVGElement | null): Promise<void>
```

This allows you to assert whether an element contains another element as a descendant or not.

```html
<span data-testid="ancestor"><span data-testid="descendant"></span></span>
```

```ts
const ancestor = getByTestId('ancestor')
const descendant = getByTestId('descendant')
const nonExistantElement = getByTestId('does-not-exist')

await expect.element(ancestor).toContainElement(descendant)
await expect.element(descendant).not.toContainElement(ancestor)
await expect.element(ancestor).not.toContainElement(nonExistantElement)
```

## toContainHTML

```ts
function toContainHTML(htmlText: string): Promise<void>
```

Assert whether a string representing a HTML element is contained in another element. The string should contain valid html, and not any incomplete html.

```html
<span data-testid="parent"><span data-testid="child"></span></span>
```

```ts
// These are valid usages
await expect.element(getByTestId('parent')).toContainHTML('<span data-testid="child"></span>')
await expect.element(getByTestId('parent')).toContainHTML('<span data-testid="child" />')
await expect.element(getByTestId('parent')).not.toContainHTML('<br />')

// These won't work
await expect.element(getByTestId('parent')).toContainHTML('data-testid="child"')
await expect.element(getByTestId('parent')).toContainHTML('data-testid')
await expect.element(getByTestId('parent')).toContainHTML('</span>')
```

::: warning
Chances are you probably do not need to use this matcher. We encourage testing from the perspective of how the user perceives the app in a browser. That's why testing against a specific DOM structure is not advised.

It could be useful in situations where the code being tested renders html that was obtained from an external source, and you want to validate that that html code was used as intended.

It should not be used to check DOM structure that you control. Please, use [`toContainElement`](#tocontainelement) instead.
:::

## toHaveAccessibleDescription

```ts
function toHaveAccessibleDescription(description?: string | RegExp): Promise<void>
```

This allows you to assert that an element has the expected
[accessible description](https://w3c.github.io/accname/).

You can pass the exact string of the expected accessible description, or you can
make a partial match passing a regular expression, or by using
[`expect.stringContaining`](/api/expect#expect-stringcontaining) or [`expect.stringMatching`](/api/expect#expect-stringmatching).

```html
<a
  data-testid="link"
  href="/"
  aria-label="Home page"
  title="A link to start over"
  >Start</a
>
<a data-testid="extra-link" href="/about" aria-label="About page">About</a>
<img src="avatar.jpg" data-testid="avatar" alt="User profile pic" />
<img
  src="logo.jpg"
  data-testid="logo"
  alt="Company logo"
  aria-describedby="t1"
/>
<span id="t1" role="presentation">The logo of Our Company</span>
<img
  src="logo.jpg"
  data-testid="logo2"
  alt="Company logo"
  aria-description="The logo of Our Company"
/>
```

```ts
await expect.element(getByTestId('link')).toHaveAccessibleDescription()
await expect.element(getByTestId('link')).toHaveAccessibleDescription('A link to start over')
await expect.element(getByTestId('link')).not.toHaveAccessibleDescription('Home page')
await expect.element(getByTestId('extra-link')).not.toHaveAccessibleDescription()
await expect.element(getByTestId('avatar')).not.toHaveAccessibleDescription()
await expect.element(getByTestId('logo')).not.toHaveAccessibleDescription('Company logo')
await expect.element(getByTestId('logo')).toHaveAccessibleDescription(
  'The logo of Our Company',
)
await expect.element(getByTestId('logo2')).toHaveAccessibleDescription(
  'The logo of Our Company',
)
```

## toHaveAccessibleErrorMessage

```ts
function toHaveAccessibleErrorMessage(message?: string | RegExp): Promise<void>
```

This allows you to assert that an element has the expected
[accessible error message](https://w3c.github.io/aria/#aria-errormessage).

You can pass the exact string of the expected accessible error message.
Alternatively, you can perform a partial match by passing a regular expression
or by using
[`expect.stringContaining`](/api/expect#expect-stringcontaining) or [`expect.stringMatching`](/api/expect#expect-stringmatching).

```html
<input
  aria-label="Has Error"
  aria-invalid="true"
  aria-errormessage="error-message"
/>
<div id="error-message" role="alert">This field is invalid</div>

<input aria-label="No Error Attributes" />
<input
  aria-label="Not Invalid"
  aria-invalid="false"
  aria-errormessage="error-message"
/>
```

```ts
// Inputs with Valid Error Messages
await expect.element(getByRole('textbox', { name: 'Has Error' })).toHaveAccessibleErrorMessage()
await expect.element(getByRole('textbox', { name: 'Has Error' })).toHaveAccessibleErrorMessage(
  'This field is invalid',
)
await expect.element(getByRole('textbox', { name: 'Has Error' })).toHaveAccessibleErrorMessage(
  /invalid/i,
)
await expect.element(
  getByRole('textbox', { name: 'Has Error' }),
).not.toHaveAccessibleErrorMessage('This field is absolutely correct!')

// Inputs without Valid Error Messages
await expect.element(
  getByRole('textbox', { name: 'No Error Attributes' }),
).not.toHaveAccessibleErrorMessage()

await expect.element(
  getByRole('textbox', { name: 'Not Invalid' }),
).not.toHaveAccessibleErrorMessage()
```

## toHaveAccessibleName

```ts
function toHaveAccessibleName(name?: string | RegExp): Promise<void>
```

This allows you to assert that an element has the expected
[accessible name](https://w3c.github.io/accname/). It is useful, for instance,
to assert that form elements and buttons are properly labelled.

You can pass the exact string of the expected accessible name, or you can make a
partial match passing a regular expression, or by using
[`expect.stringContaining`](/api/expect#expect-stringcontaining) or [`expect.stringMatching`](/api/expect#expect-stringmatching).

```html
<img data-testid="img-alt" src="" alt="Test alt" />
<img data-testid="img-empty-alt" src="" alt="" />
<svg data-testid="svg-title"><title>Test title</title></svg>
<button data-testid="button-img-alt"><img src="" alt="Test" /></button>
<p><img data-testid="img-paragraph" src="" alt="" /> Test content</p>
<button data-testid="svg-button"><svg><title>Test</title></svg></p>
<div><svg data-testid="svg-without-title"></svg></div>
<input data-testid="input-title" title="test" />
```

```javascript
await expect.element(getByTestId('img-alt')).toHaveAccessibleName('Test alt')
await expect.element(getByTestId('img-empty-alt')).not.toHaveAccessibleName()
await expect.element(getByTestId('svg-title')).toHaveAccessibleName('Test title')
await expect.element(getByTestId('button-img-alt')).toHaveAccessibleName()
await expect.element(getByTestId('img-paragraph')).not.toHaveAccessibleName()
await expect.element(getByTestId('svg-button')).toHaveAccessibleName()
await expect.element(getByTestId('svg-without-title')).not.toHaveAccessibleName()
await expect.element(getByTestId('input-title')).toHaveAccessibleName()
```

## toHaveAttribute

```ts
function toHaveAttribute(attribute: string, value?: unknown): Promise<void>
```

This allows you to check whether the given element has an attribute or not. You
can also optionally check that the attribute has a specific expected value or
partial match using [`expect.stringContaining`](/api/expect#expect-stringcontaining) or [`expect.stringMatching`](/api/expect#expect-stringmatching).

```html
<button data-testid="ok-button" type="submit" disabled>ok</button>
```

```ts
const button = getByTestId('ok-button')

await expect.element(button).toHaveAttribute('disabled')
await expect.element(button).toHaveAttribute('type', 'submit')
await expect.element(button).not.toHaveAttribute('type', 'button')

await expect.element(button).toHaveAttribute(
  'type',
  expect.stringContaining('sub')
)
await expect.element(button).toHaveAttribute(
  'type',
  expect.not.stringContaining('but')
)
```

## toHaveClass

```ts
function toHaveClass(...classNames: string[], options?: { exact: boolean }): Promise<void>
function toHaveClass(...classNames: (string | RegExp)[]): Promise<void>
```

This allows you to check whether the given element has certain classes within
its `class` attribute. You must provide at least one class, unless you are
asserting that an element does not have any classes.

The list of class names may include strings and regular expressions. Regular
expressions are matched against each individual class in the target element, and
it is NOT matched against its full `class` attribute value as whole.

::: warning
Note that you cannot use `exact: true` option when only regular expressions are provided.
:::

```html
<button data-testid="delete-button" class="btn extra btn-danger">
  Delete item
</button>
<button data-testid="no-classes">No Classes</button>
```

```ts
const deleteButton = getByTestId('delete-button')
const noClasses = getByTestId('no-classes')

await expect.element(deleteButton).toHaveClass('extra')
await expect.element(deleteButton).toHaveClass('btn-danger btn')
await expect.element(deleteButton).toHaveClass(/danger/, 'btn')
await expect.element(deleteButton).toHaveClass('btn-danger', 'btn')
await expect.element(deleteButton).not.toHaveClass('btn-link')
await expect.element(deleteButton).not.toHaveClass(/link/)

// ⚠️ regexp matches against individual classes, not the whole classList
await expect.element(deleteButton).not.toHaveClass(/btn extra/)

// the element has EXACTLY a set of classes (in any order)
await expect.element(deleteButton).toHaveClass('btn-danger extra btn', {
  exact: true
})
// if it has more than expected it is going to fail
await expect.element(deleteButton).not.toHaveClass('btn-danger extra', {
  exact: true
})

await expect.element(noClasses).not.toHaveClass()
```

## toHaveFocus

```ts
function toHaveFocus(): Promise<void>
```

This allows you to assert whether an element has focus or not.

```html
<div><input type="text" data-testid="element-to-focus" /></div>
```

```ts
const input = page.getByTestId('element-to-focus')
input.element().focus()
await expect.element(input).toHaveFocus()
input.element().blur()
await expect.element(input).not.toHaveFocus()
```

## toHaveFormValues

```ts
function toHaveFormValues(expectedValues: Record<string, unknown>): Promise<void>
```

This allows you to check if a form or fieldset contains form controls for each given name, and having the specified value.

::: tip
It is important to stress that this matcher can only be invoked on a [form](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement) or a [fieldset](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFieldSetElement) element.

This allows it to take advantage of the [`.elements`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements) property in `form` and `fieldset` to reliably fetch all form controls within them.

This also avoids the possibility that users provide a container that contains more than one `form`, thereby intermixing form controls that are not related, and could even conflict with one another.
:::

This matcher abstracts away the particularities with which a form control value
is obtained depending on the type of form control. For instance, `<input>`
elements have a `value` attribute, but `<select>` elements do not. Here's a list
of all cases covered:

- `<input type="number">` elements return the value as a **number**, instead of
  a string.
- `<input type="checkbox">` elements:
  - if there's a single one with the given `name` attribute, it is treated as a
    **boolean**, returning `true` if the checkbox is checked, `false` if
    unchecked.
  - if there's more than one checkbox with the same `name` attribute, they are
    all treated collectively as a single form control, which returns the value
    as an **array** containing all the values of the selected checkboxes in the
    collection.
- `<input type="radio">` elements are all grouped by the `name` attribute, and
  such a group treated as a single form control. This form control returns the
  value as a **string** corresponding to the `value` attribute of the selected
  radio button within the group.
- `<input type="text">` elements return the value as a **string**. This also
  applies to `<input>` elements having any other possible `type` attribute
  that's not explicitly covered in different rules above (e.g. `search`,
  `email`, `date`, `password`, `hidden`, etc.)
- `<select>` elements without the `multiple` attribute return the value as a
  **string** corresponding to the `value` attribute of the selected `option`, or
  `undefined` if there's no selected option.
- `<select multiple>` elements return the value as an **array** containing all
  the values of the [selected options](https://developer.mozilla.org/en-US/docs/Web/API/HTMLSelectElement/selectedOptions).
- `<textarea>` elements return their value as a **string**. The value
  corresponds to their node content.

The above rules make it easy, for instance, to switch from using a single select
control to using a group of radio buttons. Or to switch from a multi select
control, to using a group of checkboxes. The resulting set of form values used
by this matcher to compare against would be the same.

```html
<form data-testid="login-form">
  <input type="text" name="username" value="jane.doe" />
  <input type="password" name="password" value="12345678" />
  <input type="checkbox" name="rememberMe" checked />
  <button type="submit">Sign in</button>
</form>
```

```ts
await expect.element(getByTestId('login-form')).toHaveFormValues({
  username: 'jane.doe',
  rememberMe: true,
})
```

## toHaveStyle

```ts
function toHaveStyle(css: string | Partial<CSSStyleDeclaration>): Promise<void>
```

This allows you to check if a certain element has some specific css properties
with specific values applied. It matches only if the element has _all_ the
expected properties applied, not just some of them.

```html
<button
  data-testid="delete-button"
  style="display: none; background-color: red"
>
  Delete item
</button>
```

```ts
const button = getByTestId('delete-button')

await expect.element(button).toHaveStyle('display: none')
await expect.element(button).toHaveStyle({ display: 'none' })
await expect.element(button).toHaveStyle(`
  background-color: red;
  display: none;
`)
await expect.element(button).toHaveStyle({
  backgroundColor: 'red',
  display: 'none',
})
await expect.element(button).not.toHaveStyle(`
  background-color: blue;
  display: none;
`)
await expect.element(button).not.toHaveStyle({
  backgroundColor: 'blue',
  display: 'none',
})
```

This also works with rules that are applied to the element via a class name for
which some rules are defined in a stylesheet currently active in the document.
The usual rules of css precedence apply.

## toHaveTextContent

```ts
function toHaveTextContent(
  text: string | RegExp,
  options?: { normalizeWhitespace: boolean }
): Promise<void>
```

This allows you to check whether the given node has a text content or not. This
supports elements, but also text nodes and fragments.

When a `string` argument is passed through, it will perform a partial
case-sensitive match to the node content.

To perform a case-insensitive match, you can use a `RegExp` with the `/i`
modifier.

If you want to match the whole content, you can use a `RegExp` to do it.

```html
<span data-testid="text-content">Text Content</span>
```

```ts
const element = getByTestId('text-content')

await expect.element(element).toHaveTextContent('Content')
// to match the whole content
await expect.element(element).toHaveTextContent(/^Text Content$/)
// to use case-insensitive match
await expect.element(element).toHaveTextContent(/content$/i)
await expect.element(element).not.toHaveTextContent('content')
```

## toHaveValue

```ts
function toHaveValue(value: string | string[] | number | null): Promise<void>
```

This allows you to check whether the given form element has the specified value.
It accepts `<input>`, `<select>` and `<textarea>` elements with the exception of
`<input type="checkbox">` and `<input type="radio">`, which can be meaningfully
matched only using [`toBeChecked`](#tobechecked) or
[`toHaveFormValues`](#tohaveformvalues).

It also accepts elements with roles `meter`, `progressbar`, `slider` or
`spinbutton` and checks their `aria-valuenow` attribute (as a number).

For all other form elements, the value is matched using the same algorithm as in
[`toHaveFormValues`](#tohaveformvalues) does.

```html
<input type="text" value="text" data-testid="input-text" />
<input type="number" value="5" data-testid="input-number" />
<input type="text" data-testid="input-empty" />
<select multiple data-testid="select-number">
  <option value="first">First Value</option>
  <option value="second" selected>Second Value</option>
  <option value="third" selected>Third Value</option>
</select>
```

```ts
const textInput = getByTestId('input-text')
const numberInput = getByTestId('input-number')
const emptyInput = getByTestId('input-empty')
const selectInput = getByTestId('select-number')

await expect.element(textInput).toHaveValue('text')
await expect.element(numberInput).toHaveValue(5)
await expect.element(emptyInput).not.toHaveValue()
await expect.element(selectInput).toHaveValue(['second', 'third'])
```

## toHaveDisplayValue

```typescript
function toHaveDisplayValue(
  value: string | RegExp | (string | RegExp)[]
): Promise<void>
```

This allows you to check whether the given form element has the specified
displayed value (the one the end user will see). It accepts `<input>`,
`<select>` and `<textarea>` elements with the exception of
`<input type="checkbox">` and `<input type="radio">`, which can be meaningfully
matched only using [`toBeChecked`](#tobechecked) or
[`toHaveFormValues`](#tohaveformvalues).

```html
<label for="input-example">First name</label>
<input type="text" id="input-example" value="Luca" />

<label for="textarea-example">Description</label>
<textarea id="textarea-example">An example description here.</textarea>

<label for="single-select-example">Fruit</label>
<select id="single-select-example">
  <option value="">Select a fruit...</option>
  <option value="banana">Banana</option>
  <option value="ananas">Ananas</option>
  <option value="avocado">Avocado</option>
</select>

<label for="multiple-select-example">Fruits</label>
<select id="multiple-select-example" multiple>
  <option value="">Select a fruit...</option>
  <option value="banana" selected>Banana</option>
  <option value="ananas">Ananas</option>
  <option value="avocado" selected>Avocado</option>
</select>
```

```ts
const input = page.getByLabelText('First name')
const textarea = page.getByLabelText('Description')
const selectSingle = page.getByLabelText('Fruit')
const selectMultiple = page.getByLabelText('Fruits')

await expect.element(input).toHaveDisplayValue('Luca')
await expect.element(input).toHaveDisplayValue(/Luc/)
await expect.element(textarea).toHaveDisplayValue('An example description here.')
await expect.element(textarea).toHaveDisplayValue(/example/)
await expect.element(selectSingle).toHaveDisplayValue('Select a fruit...')
await expect.element(selectSingle).toHaveDisplayValue(/Select/)
await expect.element(selectMultiple).toHaveDisplayValue([/Avocado/, 'Banana'])
```

## toBeChecked

```ts
function toBeChecked(): Promise<void>
```

This allows you to check whether the given element is checked. It accepts an
`input` of type `checkbox` or `radio` and elements with a `role` of `checkbox`,
`radio` or `switch` with a valid `aria-checked` attribute of `"true"` or
`"false"`.

```html
<input type="checkbox" checked data-testid="input-checkbox-checked" />
<input type="checkbox" data-testid="input-checkbox-unchecked" />
<div role="checkbox" aria-checked="true" data-testid="aria-checkbox-checked" />
<div
  role="checkbox"
  aria-checked="false"
  data-testid="aria-checkbox-unchecked"
/>

<input type="radio" checked value="foo" data-testid="input-radio-checked" />
<input type="radio" value="foo" data-testid="input-radio-unchecked" />
<div role="radio" aria-checked="true" data-testid="aria-radio-checked" />
<div role="radio" aria-checked="false" data-testid="aria-radio-unchecked" />
<div role="switch" aria-checked="true" data-testid="aria-switch-checked" />
<div role="switch" aria-checked="false" data-testid="aria-switch-unchecked" />
```

```ts
const inputCheckboxChecked = getByTestId('input-checkbox-checked')
const inputCheckboxUnchecked = getByTestId('input-checkbox-unchecked')
const ariaCheckboxChecked = getByTestId('aria-checkbox-checked')
const ariaCheckboxUnchecked = getByTestId('aria-checkbox-unchecked')
await expect.element(inputCheckboxChecked).toBeChecked()
await expect.element(inputCheckboxUnchecked).not.toBeChecked()
await expect.element(ariaCheckboxChecked).toBeChecked()
await expect.element(ariaCheckboxUnchecked).not.toBeChecked()

const inputRadioChecked = getByTestId('input-radio-checked')
const inputRadioUnchecked = getByTestId('input-radio-unchecked')
const ariaRadioChecked = getByTestId('aria-radio-checked')
const ariaRadioUnchecked = getByTestId('aria-radio-unchecked')
await expect.element(inputRadioChecked).toBeChecked()
await expect.element(inputRadioUnchecked).not.toBeChecked()
await expect.element(ariaRadioChecked).toBeChecked()
await expect.element(ariaRadioUnchecked).not.toBeChecked()

const ariaSwitchChecked = getByTestId('aria-switch-checked')
const ariaSwitchUnchecked = getByTestId('aria-switch-unchecked')
await expect.element(ariaSwitchChecked).toBeChecked()
await expect.element(ariaSwitchUnchecked).not.toBeChecked()
```

## toBePartiallyChecked

```typescript
function toBePartiallyChecked(): Promise<void>
```

This allows you to check whether the given element is partially checked. It
accepts an `input` of type `checkbox` and elements with a `role` of `checkbox`
with a `aria-checked="mixed"`, or `input` of type `checkbox` with
`indeterminate` set to `true`

```html
<input type="checkbox" aria-checked="mixed" data-testid="aria-checkbox-mixed" />
<input type="checkbox" checked data-testid="input-checkbox-checked" />
<input type="checkbox" data-testid="input-checkbox-unchecked" />
<div role="checkbox" aria-checked="true" data-testid="aria-checkbox-checked" />
<div
  role="checkbox"
  aria-checked="false"
  data-testid="aria-checkbox-unchecked"
/>
<input type="checkbox" data-testid="input-checkbox-indeterminate" />
```

```ts
const ariaCheckboxMixed = getByTestId('aria-checkbox-mixed')
const inputCheckboxChecked = getByTestId('input-checkbox-checked')
const inputCheckboxUnchecked = getByTestId('input-checkbox-unchecked')
const ariaCheckboxChecked = getByTestId('aria-checkbox-checked')
const ariaCheckboxUnchecked = getByTestId('aria-checkbox-unchecked')
const inputCheckboxIndeterminate = getByTestId('input-checkbox-indeterminate')

await expect.element(ariaCheckboxMixed).toBePartiallyChecked()
await expect.element(inputCheckboxChecked).not.toBePartiallyChecked()
await expect.element(inputCheckboxUnchecked).not.toBePartiallyChecked()
await expect.element(ariaCheckboxChecked).not.toBePartiallyChecked()
await expect.element(ariaCheckboxUnchecked).not.toBePartiallyChecked()

inputCheckboxIndeterminate.element().indeterminate = true
await expect.element(inputCheckboxIndeterminate).toBePartiallyChecked()
```

## toHaveRole

```ts
function toHaveRole(role: ARIARole): Promise<void>
```

This allows you to assert that an element has the expected [role](https://www.w3.org/TR/html-aria/#docconformance).

This is useful in cases where you already have access to an element via some query other than the role itself, and want to make additional assertions regarding its accessibility.

The role can match either an explicit role (via the `role` attribute), or an implicit one via the [implicit ARIA semantics](https://www.w3.org/TR/html-aria/#docconformance).

```html
<button data-testid="button">Continue</button>
<div role="button" data-testid="button-explicit">Continue</button>
<button role="switch button" data-testid="button-explicit-multiple">Continue</button>
<a href="/about" data-testid="link">About</a>
<a data-testid="link-invalid">Invalid link<a/>
```

```ts
await expect.element(getByTestId('button')).toHaveRole('button')
await expect.element(getByTestId('button-explicit')).toHaveRole('button')
await expect.element(getByTestId('button-explicit-multiple')).toHaveRole('button')
await expect.element(getByTestId('button-explicit-multiple')).toHaveRole('switch')
await expect.element(getByTestId('link')).toHaveRole('link')
await expect.element(getByTestId('link-invalid')).not.toHaveRole('link')
await expect.element(getByTestId('link-invalid')).toHaveRole('generic')
```

::: warning
Roles are matched literally by string equality, without inheriting from the ARIA role hierarchy. As a result, querying a superclass role like `checkbox` will not include elements with a subclass role like `switch`.

Also note that unlike `testing-library`, Vitest ignores all custom roles except the first valid one, following Playwright's behaviour:

```jsx
<div data-testid="switch" role="switch alert"></div>

await expect.element(getByTestId('switch')).toHaveRole('switch') // ✅
await expect.element(getByTestId('switch')).toHaveRole('alert') // ❌
```
:::

## toHaveSelection

```ts
function toHaveSelection(selection?: string): Promise<void>
```

This allows to assert that an element has a
[text selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection).

This is useful to check if text or part of the text is selected within an
element. The element can be either an input of type text, a textarea, or any
other element that contains text, such as a paragraph, span, div etc.

::: warning
The expected selection is a string, it does not allow to check for
selection range indeces.
:::

```html
<div>
  <input type="text" value="text selected text" data-testid="text" />
  <textarea data-testid="textarea">text selected text</textarea>
  <p data-testid="prev">prev</p>
  <p data-testid="parent">
    text <span data-testid="child">selected</span> text
  </p>
  <p data-testid="next">next</p>
</div>
```

```ts
getByTestId('text').element().setSelectionRange(5, 13)
await expect.element(getByTestId('text')).toHaveSelection('selected')

getByTestId('textarea').element().setSelectionRange(0, 5)
await expect.element('textarea').toHaveSelection('text ')

const selection = document.getSelection()
const range = document.createRange()
selection.removeAllRanges()
selection.empty()
selection.addRange(range)

// selection of child applies to the parent as well
range.selectNodeContents(getByTestId('child').element())
await expect.element(getByTestId('child')).toHaveSelection('selected')
await expect.element(getByTestId('parent')).toHaveSelection('selected')

// selection that applies from prev all, parent text before child, and part child.
range.setStart(getByTestId('prev').element(), 0)
range.setEnd(getByTestId('child').element().childNodes[0], 3)
await expect.element(queryByTestId('prev')).toHaveSelection('prev')
await expect.element(queryByTestId('child')).toHaveSelection('sel')
await expect.element(queryByTestId('parent')).toHaveSelection('text sel')
await expect.element(queryByTestId('next')).not.toHaveSelection()

// selection that applies from part child, parent text after child and part next.
range.setStart(getByTestId('child').element().childNodes[0], 3)
range.setEnd(getByTestId('next').element().childNodes[0], 2)
await expect.element(queryByTestId('child')).toHaveSelection('ected')
await expect.element(queryByTestId('parent')).toHaveSelection('ected text')
await expect.element(queryByTestId('prev')).not.toHaveSelection()
await expect.element(queryByTestId('next')).toHaveSelection('ne')
```

## toMatchScreenshot

```ts
function toMatchScreenshot(
  options?: ScreenshotMatcherOptions,
): Promise<void>
function toMatchScreenshot(
  name?: string,
  options?: ScreenshotMatcherOptions,
): Promise<void>
```

::: tip
The `toMatchScreenshot` assertion can be configured globally in your
[Vitest config](/guide/browser/config#browser-expect-tomatchscreenshot).
:::

This assertion allows you to perform visual regression testing by comparing
screenshots of elements or pages against stored reference images.

When differences are detected beyond the configured threshold, the test fails.
To help identify the changes, the assertion generates:

- The actual screenshot captured during the test
- The expected reference screenshot
- A diff image highlighting the differences (when possible)

::: warning Screenshots Stability
The assertion automatically retries taking screenshots until two consecutive
captures yield the same result. This helps reduce flakiness caused by
animations, loading states, or other dynamic content. You can control this
behavior with the `timeout` option.

However, browser rendering can vary across:

- Different browsers and browser versions
- Operating systems (Windows, macOS, Linux)
- Screen resolutions and pixel densities
- GPU drivers and hardware acceleration
- Font rendering and system fonts

It is recommended to read the
[Visual Regression Testing guide](/) to
implement this testing strategy efficiently.
:::

::: tip
When a screenshot comparison fails due to **intentional changes**, you can
update the reference screenshot by pressing the `u` key in watch mode, or by
running tests with the `-u` or `--update` flags.
:::

```html
<button data-testid="button">Fancy Button</button>
```

```ts
// basic usage, auto-generates screenshot name
await expect.element(getByTestId('button')).toMatchScreenshot()

// with custom name
await expect.element(getByTestId('button')).toMatchScreenshot('fancy-button')

// with options
await expect.element(getByTestId('button')).toMatchScreenshot({
  comparatorName: 'pixelmatch',
  comparatorOptions: {
    allowedMismatchedPixelRatio: 0.01,
  },
})

// with both name and options
await expect.element(getByTestId('button')).toMatchScreenshot('fancy-button', {
  comparatorName: 'pixelmatch',
  comparatorOptions: {
    allowedMismatchedPixelRatio: 0.01,
  },
})
```

### Options

- `comparatorName: "pixelmatch" = "pixelmatch"`

  The name of the algorithm/library used for comparing images.

  Currently, [`"pixelmatch"`](https://github.com/mapbox/pixelmatch) is the only
  supported comparator.

- `comparatorOptions: object`

  These options allow changing the behavior of the comparator. What properties
  can be set depends on the chosen comparator algorithm.

  Vitest has set default values out of the box, but they can be overridden.

  - [`"pixelmatch"` options](#pixelmatch-comparator-options)

  ::: warning
  **Always explicitly set `comparatorName` to get proper type inference for
  `comparatorOptions`**.

  Without it, TypeScript won't know which options are valid:

  ```ts
  // ❌ TypeScript can't infer the correct options
  await expect.element(button).toMatchScreenshot({
    comparatorOptions: {
      // might error when new comparators are added
      allowedMismatchedPixelRatio: 0.01,
    },
  })

  // ✅ TypeScript knows these are pixelmatch options
  await expect.element(button).toMatchScreenshot({
    comparatorName: 'pixelmatch',
    comparatorOptions: {
      allowedMismatchedPixelRatio: 0.01,
    },
  })
  ```
  :::

- `screenshotOptions: object`

  The same options allowed by
  [`locator.screenshot()`](/guide/browser/locators.html#screenshot), except for:

  - `'base64'`
  - `'path'`
  - `'save'`
  - `'type'`

- `timeout: number = 5_000`

  Time to wait until a stable screenshot is found.

  Setting this value to `0` disables the timeout, but if a stable screenshot
  can't be determined the process will not end.

#### `"pixelmatch"` comparator options

The following options are available when using the `"pixelmatch"` comparator:

- `allowedMismatchedPixelRatio: number | undefined = undefined`

  The maximum allowed ratio of differing pixels between the captured screenshot
  and the reference image.

  Must be a value between `0` and `1`.

  For example, `allowedMismatchedPixelRatio: 0.02` means the test will pass
  if up to 2% of pixels differ, but fail if more than 2% differ.

- `allowedMismatchedPixels: number | undefined = undefined`

  The maximum number of pixels that are allowed to differ between the captured
  screenshot and the stored reference image.

  If set to `undefined`, any non-zero difference will cause the test to fail.

  For example, `allowedMismatchedPixels: 10` means the test will pass if 10 or
  fewer pixels differ, but fail if 11 or more differ.

- `threshold: number = 0.1`

  Acceptable perceived color difference between the same pixel in two images.

  Value ranges from `0` (strict) to `1` (very lenient). Lower values mean small
  differences will be detected.

  The comparison uses the [YIQ color space](https://en.wikipedia.org/wiki/YIQ).

- `includeAA: boolean = false`

  If `true`, disables detection and ignoring of anti-aliased pixels.

- `alpha: number = 0.1`

  Blending level of unchanged pixels in the diff image.

  Ranges from `0` (white) to `1` (original brightness).

- `aaColor: [r: number, g: number, b: number] = [255, 255, 0]`

  Color used for anti-aliased pixels in the diff image.

- `diffColor: [r: number, g: number, b: number] = [255, 0, 0]`

  Color used for differing pixels in the diff image.

- `diffColorAlt: [r: number, g: number, b: number] | undefined = undefined`

  Optional alternative color for dark-on-light differences, to help show what's
  added vs. removed.

  If not set, `diffColor` is used for all differences.

- `diffMask: boolean = false`

  If `true`, shows only the diff as a mask on a transparent background, instead
  of overlaying it on the original image.

  Anti-aliased pixels won't be shown (if detected).

::: warning
When both `allowedMismatchedPixels` and `allowedMismatchedPixelRatio` are set,
the more restrictive value is used.

For example, if you allow 100 pixels or 2% ratio, and your image has 10,000
pixels, the effective limit would be 100 pixels instead of 200.
:::
