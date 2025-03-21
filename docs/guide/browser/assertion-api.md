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
function toBeDisabled(): void
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
function toBeEnabled(): void
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
function toBeEmptyDOMElement(): void
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
function toBeInTheDocument(): void
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
function toBeInvalid(): void
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
function toBeRequired(): void
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
function toBeValid(): void
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
function toBeVisible(): void
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
function toContainElement(element: HTMLElement | SVGElement | null): void
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
function toContainHTML(htmlText: string): void
```

Assert whether a string representing a HTML element is contained in another element. The string should contain valid html, and not any incomplete html.

```html
<span data-testid="parent"><span data-testid="child"></span></span>
```

```ts
// These are valid uses
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
## toHaveAccessibleErrorMessage
## toHaveAccessibleName
## toHaveAttribute
## toHaveClass
## toHaveFocus

```ts
function toHaveFocus(): void
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
function toHaveFormValues(expectedValues: Record<string, unknown>): void
```

## toHaveStyle
## toHaveTextContent
## toHaveValue
## toHaveDisplayValue
## toBeChecked
## toBePartiallyChecked
## toHaveRole

```ts
function toHaveRole(role: ARIARole): void
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
