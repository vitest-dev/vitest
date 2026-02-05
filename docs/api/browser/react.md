---
outline: deep
---

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
This library takes inspiration from [`@testing-library/react`](https://github.com/testing-library/react-testing-library).

If you have used `@testing-library/react` in your tests before, you can keep using it, however the `vitest-browser-react` package provides certain benefits unique to the Browser Mode that `@testing-library/react` lacks:

`vitest-browser-react` returns APIs that interact well with built-in [locators](/api/browser/locators), [user events](/api/browser/interactivity) and [assertions](/api/browser/assertions): for example, Vitest will automatically retry the element until the assertion is successful, even if it was rerendered between the assertions.
:::

The package exposes two entry points: `vitest-browser-react` and `vitest-browser-react/pure`. They expose almost identical API (`pure` also exposes `configure`), but the `pure` entry point doesn't add a handler to remove the component before the next test has started.

## render

```ts
export function render(
  ui: React.ReactNode,
  options?: ComponentRenderOptions,
): Promise<RenderResult>
```

:::warning
Note that `render` is asynchronous, unlike in other packages. This is to support [`Suspense`](https://react.dev/reference/react/Suspense) correctly.

```tsx
import { render } from 'vitest-browser-react'
const screen = render(<Component />) // [!code --]
const screen = await render(<Component />) // [!code ++]
```
:::

### Options

#### container

By default, Vitest will create a `div`, append it to `document.body`, and render your component there. If you provide your own `HTMLElement` container, it will not be appended automatically — you'll need to call `document.body.appendChild(container)` before `render`.

For example, if you are unit testing a `tbody` element, it cannot be a child of a `div`. In this case, you can specify a `table` as the render container.

```jsx
const table = document.createElement('table')

const { container } = await render(<TableBody {...props} />, {
  // ⚠️ appending the element to `body` manually before rendering
  container: document.body.appendChild(table),
})
```

#### baseElement

If the `container` is specified, then this defaults to that, otherwise this defaults to `document.body`. This is used as the base element for the queries as well as what is printed when you use `debug()`.

#### wrapper

Pass a React Component as the `wrapper` option to have it rendered around the inner element. This is most useful for creating reusable custom render functions for common data providers. For example:

```jsx
import React from 'react'
import { render } from 'vitest-browser-react'
import { ThemeProvider } from 'my-ui-lib'
import { TranslationProvider } from 'my-i18n-lib'

function AllTheProviders({ children }) {
  return (
    <ThemeProvider theme="light">
      <TranslationProvider>
        {children}
      </TranslationProvider>
    </ThemeProvider>
  )
}

export function customRender(ui, options) {
  return render(ui, { wrapper: AllTheProviders, ...options })
}
```

### Render Result

In addition to documented return value, the `render` function also returns all available [locators](/api/browser/locators) relative to the [`baseElement`](#baseelement), including [custom ones](/api/browser/locators#custom-locators).

```tsx
const screen = await render(<TableBody {...props} />)

await screen.getByRole('link', { name: 'Expand' }).click()
```

#### container

The containing `div` DOM node of your rendered React Element (rendered using `ReactDOM.render`). This is a regular DOM node, so you technically could call `container.querySelector` etc. to inspect the children.

:::danger
If you find yourself using `container` to query for rendered elements then you should reconsider! The [locators](/api/browser/locators) are designed to be more resilient to changes that will be made to the component you're testing. Avoid using `container` to query for elements!
:::

#### baseElement

The containing DOM node where your React Element is rendered in the `container`. If you don't specify the `baseElement` in the options of render, it will default to `document.body`.

This is useful when the component you want to test renders something outside the container `div`, e.g. when you want to snapshot test your portal component which renders its HTML directly in the body.

:::tip
The queries returned by the `render` looks into `baseElement`, so you can use queries to test your portal component without the `baseElement`.
:::

#### locator

The [locator](/api/browser/locators) of your `container`. It is useful to use queries scoped only to your component, or pass it down to other assertions:

```jsx
import { render } from 'vitest-browser-react'

const { locator } = await render(<NumberDisplay number={1} />)

await locator.getByRole('button').click()
await expect.element(locator).toHaveTextContent('Hello World')
```

#### debug

```ts
function debug(
  el?: HTMLElement | HTMLElement[] | Locator | Locator[],
  maxLength?: number,
  options?: PrettyDOMOptions,
): void
```

This method is a shortcut for `console.log(prettyDOM(baseElement))`. It will print the DOM content of the container or specified elements to the console.

#### rerender

```ts
function rerender(ui: React.ReactNode): Promise<void>
```

It is better if you test the component that's doing the prop updating to ensure that the props are being updated correctly to avoid relying on implementation details in your tests. That said, if you'd prefer to update the props of a rendered component in your test, this function can be used to update props of the rendered component.

```jsx
import { render } from 'vitest-browser-react'

const { rerender } = await render(<NumberDisplay number={1} />)

// re-render the same component with different props
await rerender(<NumberDisplay number={2} />)
```

#### unmount

```ts
function unmount(): Promise<void>
```

This will cause the rendered component to be unmounted. This is useful for testing what happens when your component is removed from the page (like testing that you don't leave event handlers hanging around causing memory leaks).

```jsx
import { render } from 'vitest-browser-react'

const { container, unmount } = await render(<Login />)
await unmount()
// your component has been unmounted and now: container.innerHTML === ''
```

#### asFragment

```ts
function asFragment(): DocumentFragment
```

Returns a `DocumentFragment` of your rendered component. This can be useful if you need to avoid live bindings and see how your component reacts to events.

## cleanup

```ts
export function cleanup(): Promise<void>
```

Remove all components rendered with [`render`](#render).

## renderHook

```ts
export function renderHook<Props, Result>(
  renderCallback: (initialProps?: Props) => Result,
  options: RenderHookOptions<Props>,
): Promise<RenderHookResult<Result, Props>>
```

This is a convenience wrapper around `render` with a custom test component. The API emerged from a popular testing pattern and is mostly interesting for libraries publishing hooks. You should prefer `render` since a custom test component results in more readable and robust tests since the thing you want to test is not hidden behind an abstraction.

```jsx
import { renderHook } from 'vitest-browser-react'

test('returns logged in user', async () => {
  const { result } = await renderHook(() => useLoggedInUser())
  expect(result.current).toEqual({ name: 'Alice' })
})
```

### Options

`renderHook` accepts the same options as [`render`](#render) with an addition to `initialProps`:

It declares the props that are passed to the render-callback when first invoked. These will not be passed if you call `rerender` without props.

```jsx
import { renderHook } from 'vitest-browser-react'

test('returns logged in user', async () => {
  const { result, rerender } = await renderHook((props = {}) => props, {
    initialProps: { name: 'Alice' },
  })
  expect(result.current).toEqual({ name: 'Alice' })
  await rerender()
  expect(result.current).toEqual({ name: undefined })
})
```

:::warning
When using `renderHook` in conjunction with the `wrapper` and `initialProps` options, the `initialProps` are not passed to the `wrapper` component. To provide props to the `wrapper` component, consider a solution like this:

```jsx
function createWrapper(Wrapper, props) {
  return function CreatedWrapper({ children }) {
    return <Wrapper {...props}>{children}</Wrapper>
  }
}

// ...

await renderHook(() => {}, {
  wrapper: createWrapper(Wrapper, { value: 'foo' }),
})
```
:::

`renderHook` returns a few useful methods and properties:

### Render Hook Result

#### result

Holds the value of the most recently committed return value of the render-callback:

```jsx
import { useState } from 'react'
import { renderHook } from 'vitest-browser-react'
import { expect } from 'vitest'

const { result } = await renderHook(() => {
  const [name, setName] = useState('')
  React.useEffect(() => {
    setName('Alice')
  }, [])

  return name
})

expect(result.current).toBe('Alice')
```

Note that the value is held in `result.current`. Think of result as a [ref](https://react.dev/learn/referencing-values-with-refs) for the most recently committed value.

#### rerender {#renderhooks-rerender}

Renders the previously rendered render-callback with the new props:

```jsx
import { renderHook } from 'vitest-browser-react'

const { rerender } = await renderHook(({ name = 'Alice' } = {}) => name)

// re-render the same hook with different props
await rerender({ name: 'Bob' })
```

#### unmount {#renderhooks-unmount}

Unmounts the test hook.

```jsx
import { renderHook } from 'vitest-browser-react'

const { unmount } = await renderHook(({ name = 'Alice' } = {}) => name)

await unmount()
```

## Extend Queries

To extend locator queries, see [`"Custom Locators"`](/api/browser/locators#custom-locators). For example, to make `render` return a new custom locator, define it using the `locators.extend` API:

```jsx {5-7,12}
import { locators } from 'vitest/browser'
import { render } from 'vitest-browser-react'

locators.extend({
  getByArticleTitle(title) {
    return `[data-title="${title}"]`
  },
})

const screen = await render(<Component />)
await expect.element(
  screen.getByArticleTitle('Hello World')
).toBeVisible()
```

## Configuration

You can configure if the component should be rendered in Strict Mode with configure method from `vitest-browser-react/pure`:

```js
import { configure } from 'vitest-browser-react/pure'

configure({
  // disabled by default
  reactStrictMode: true,
})
```

## See also

- [React Testing Library documentation](https://testing-library.com/docs/react-testing-library/intro)
