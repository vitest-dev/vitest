---
title: Assertion API | Browser Mode
---

# Assertion API

Vitest bundles the [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom) library to provide a wide range of DOM assertions out of the box. For detailed documentation, you can read the `jest-dom` readme:

- [`toBeDisabled`](https://github.com/testing-library/jest-dom#toBeDisabled)
- [`toBeEnabled`](https://github.com/testing-library/jest-dom#toBeEnabled)
- [`toBeEmptyDOMElement`](https://github.com/testing-library/jest-dom#toBeEmptyDOMElement)
- [`toBeInTheDocument`](https://github.com/testing-library/jest-dom#toBeInTheDocument)
- [`toBeInvalid`](https://github.com/testing-library/jest-dom#toBeInvalid)
- [`toBeRequired`](https://github.com/testing-library/jest-dom#toBeRequired)
- [`toBeValid`](https://github.com/testing-library/jest-dom#toBeValid)
- [`toBeVisible`](https://github.com/testing-library/jest-dom#toBeVisible)
- [`toContainElement`](https://github.com/testing-library/jest-dom#toContainElement)
- [`toContainHTML`](https://github.com/testing-library/jest-dom#toContainHTML)
- [`toHaveAccessibleDescription`](https://github.com/testing-library/jest-dom#toHaveAccessibleDescription)
- [`toHaveAccessibleErrorMessage`](https://github.com/testing-library/jest-dom#toHaveAccessibleErrorMessage)
- [`toHaveAccessibleName`](https://github.com/testing-library/jest-dom#toHaveAccessibleName)
- [`toHaveAttribute`](https://github.com/testing-library/jest-dom#toHaveAttribute)
- [`toHaveClass`](https://github.com/testing-library/jest-dom#toHaveClass)
- [`toHaveFocus`](https://github.com/testing-library/jest-dom#toHaveFocus)
- [`toHaveFormValues`](https://github.com/testing-library/jest-dom#toHaveFormValues)
- [`toHaveStyle`](https://github.com/testing-library/jest-dom#toHaveStyle)
- [`toHaveTextContent`](https://github.com/testing-library/jest-dom#toHaveTextContent)
- [`toHaveValue`](https://github.com/testing-library/jest-dom#toHaveValue)
- [`toHaveDisplayValue`](https://github.com/testing-library/jest-dom#toHaveDisplayValue)
- [`toBeChecked`](https://github.com/testing-library/jest-dom#toBeChecked)
- [`toBePartiallyChecked`](https://github.com/testing-library/jest-dom#toBePartiallyChecked)
- [`toHaveRole`](https://github.com/testing-library/jest-dom#toHaveRole)
- [`toHaveErrorMessage`](https://github.com/testing-library/jest-dom#toHaveErrorMessage)

If you are using [TypeScript](/guide/browser/#typescript) or want to have correct type hints in `expect`, make sure you have either `@vitest/browser/providers/playwright` or `@vitest/browser/providers/webdriverio` referenced in your [setup file](/config/#setupfile) or a [config file](/config/) depending on the provider you use. If you use the default `preview` provider, you can specify `@vitest/browser/matchers` instead.

::: code-group
```ts [preview]
/// <reference types="@vitest/browser/matchers" />
```
```ts [playwright]
/// <reference types="@vitest/browser/providers/playwright" />
```
```ts [webdriverio]
/// <reference types="@vitest/browser/providers/webdriverio" />
```
:::

Tests in the browser might fail inconsistently due to their asynchronous nature. Because of this, it is important to have a way to guarantee that assertions succeed even if the condition is delayed (by a timeout, network request, or animation, for example). For this purpose, Vitest provides retriable assertions out of the box via the [`expect.poll`](/api/expect#poll) and `expect.element` APIs:

```ts
import { expect, test } from 'vitest'
import { page } from '@vitest/browser/context'

test('error banner is rendered', async () => {
  triggerError()

  // @testing-library provides queries with built-in retry-ability
  // It will try to find the banner until it's rendered
  const banner = page.getByRole('alert', {
    name: /error/i,
  })

  // Vitest provides `expect.element` with built-in retry-ability
  // It will check `element.textContent` until it's equal to "Error!"
  await expect.element(banner).toHaveTextContent('Error!')
})
```

::: tip
`expect.element` is a shorthand for `expect.poll(() => element)` and works in exactly the same way.

`toHaveTextContent` and all other [`@testing-library/jest-dom`](https://github.com/testing-library/jest-dom) assertions are still available on a regular `expect` without a built-in retry-ability mechanism:

```ts
// will fail immediately if .textContent is not `'Error!'`
expect(banner).toHaveTextContent('Error!')
```
:::
