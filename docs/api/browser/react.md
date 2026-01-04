# vitest-browser-react

The community [`vitest-browser-react`](https://www.npmjs.com/package/vitest-browser-react) package renders [React](https://react.dev/) components in [Browser Mode](/guide/browser/).

```jsx
import { render } from 'vitest-browser-react'
import { expect, test } from 'vitest'
import Component from './Component.jsx'

test('counter button increments the count', async () => {
  const screen = await render(<Component count={1} />)

  await screen.getByRole('button', { name: 'Increment' }).click()

  await expect.element(screen.getByText('Count is 2')).toBeVisible()
})
```

::: warning
This library takes an inspiration from [`@testing-library/react`](https://github.com/testing-library/react-testing-library), but note that the `render` function is asynchronous.

If you have used `@testing-library/react` in your tests before, you can keep using it, however the `vitest-browser-react` package provides certain benefits unique to the Browser Mode that `@testing-library/react` lacks:

`vitest-browser-react` returns APIs that interact well with built-in [locators](/api/browser/locators), [user events](/api/browser/interactivity) and [assertions](/api/browser/assertions): for example, Vitest will automatically retry the element until the assertion is successful, even if it was rerendered between the assertions.
:::

## Configuration

You can configure if the component should be rendered in Strict Mode with configure method from `vitest-browser-react/pure`:

```js
import { configure } from 'vitest-browser-react/pure'

configure({
  // disabled by default
  reactStrictMode: true,
})
```
