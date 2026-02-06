---
outline: deep
---

# vitest-browser-vue

The community [`vitest-browser-vue`](https://www.npmjs.com/package/vitest-browser-vue) package renders [Vue](https://vuejs.org/) components in [Browser Mode](/guide/browser/).

```ts
import { render } from 'vitest-browser-vue'
import { expect, test } from 'vitest'
import Component from './Component.vue'

test('counter button increments the count', async () => {
  const screen = render(Component, {
    props: {
      initialCount: 1,
    }
  })

  await screen.getByRole('button', { name: 'Increment' }).click()

  await expect.element(screen.getByText('Count is 2')).toBeVisible()
})
```

::: warning
This library takes inspiration from [`@testing-library/vue`](https://github.com/testing-library/vue-testing-library).

If you have used `@testing-library/vue` in your tests before, you can keep using it, however the `vitest-browser-vue` package provides certain benefits unique to the Browser Mode that `@testing-library/vue` lacks:

`vitest-browser-vue` returns APIs that interact well with built-in [locators](/api/browser/locators), [user events](/api/browser/interactivity) and [assertions](/api/browser/assertions): for example, Vitest will automatically retry the element until the assertion is successful, even if it was rerendered between the assertions.
:::

The package exposes two entry points: `vitest-browser-vue` and `vitest-browser-vue/pure`. They expose identical API, but the `pure` entry point doesn't add a handler to remove the component before the next test has started.

## render

```ts
export function render(
  component: Component,
  options?: ComponentRenderOptions,
): RenderResult
```

### Options

The `render` function supports all [`mount` options](https://test-utils.vuejs.org/api/#mount) from `@vue/test-utils` (except `attachTo` - use `container` instead). In addition to them, there are also `container` and `baseElement`.

#### container

By default, Vitest will create a `div`, append it to `document.body`, and render your component there. If you provide your own `HTMLElement` container, it will not be appended automatically — you'll need to call `document.body.appendChild(container)` before `render`.

For example, if you are unit testing a `tbody` element, it cannot be a child of a `div`. In this case, you can specify a `table` as the render container.

```js
const table = document.createElement('table')

const { container } = render(TableBody, {
  props,
  // ⚠️ appending the element to `body` manually before rendering
  container: document.body.appendChild(table),
})
```

#### baseElement

If the `container` is specified, then this defaults to that, otherwise this defaults to `document.body`. This is used as the base element for the queries as well as what is printed when you use `debug()`.

### Render Result

In addition to documented return value, the `render` function also returns all available [locators](/api/browser/locators) relative to the [`baseElement`](#baseelement), including [custom ones](/api/browser/locators#custom-locators).

```ts
const screen = render(TableBody, { props })

await screen.getByRole('link', { name: 'Expand' }).click()
```

#### container

The containing DOM node where your Vue component is rendered. This is a regular DOM node, so you technically could call `container.querySelector` etc. to inspect the children.

:::danger
If you find yourself using `container` to query for rendered elements then you should reconsider! The [locators](/api/browser/locators) are designed to be more resilient to changes that will be made to the component you're testing. Avoid using `container` to query for elements!
:::

#### baseElement

The containing DOM node where your Vue component is rendered in the `container`. If you don't specify the `baseElement` in the options of render, it will default to `document.body`.

This is useful when the component you want to test renders something outside the container `div`, e.g. when you want to snapshot test your portal component which renders its HTML directly in the body.

:::tip
The queries returned by the `render` looks into `baseElement`, so you can use queries to test your portal component without the `baseElement`.
:::

#### locator

The [locator](/api/browser/locators) of your `container`. It is useful to use queries scoped only to your component, or pass it down to other assertions:

```js
import { render } from 'vitest-browser-vue'

const { locator } = render(NumberDisplay, {
  props: { number: 2 }
})

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
function rerender(props: Partial<Props>): void
```

It is better if you test the component that's doing the prop updating to ensure that the props are being updated correctly to avoid relying on implementation details in your tests. That said, if you'd prefer to update the props of a rendered component in your test, this function can be used to update props of the rendered component.

```js
import { render } from 'vitest-browser-vue'

const { rerender } = render(NumberDisplay, { props: { number: 1 } })

// re-render the same component with different props
rerender({ number: 2 })
```

#### unmount

```ts
function unmount(): void
```

This will cause the rendered component to be unmounted. This is useful for testing what happens when your component is removed from the page (like testing that you don't leave event handlers hanging around causing memory leaks).

#### emitted

```ts
function emitted<T = unknown>(): Record<string, T[]>
function emitted<T = unknown[]>(eventName: string): undefined | T[]
```

Returns the emitted events from the Component.

::: warning
Emitted values are an implementation detail not exposed directly to the user, so it is better to test how your emitted values are changing the displayed content by using [locators](/api/browser/locators) instead.
:::

## cleanup

```ts
export function cleanup(): void
```

Remove all components rendered with [`render`](#render).

## Extend Queries

To extend locator queries, see [`"Custom Locators"`](/api/browser/locators#custom-locators). For example, to make `render` return a new custom locator, define it using the `locators.extend` API:

```js {5-7,12}
import { locators } from 'vitest/browser'
import { render } from 'vitest-browser-vue'

locators.extend({
  getByArticleTitle(title) {
    return `[data-title="${title}"]`
  },
})

const screen = render(Component)
await expect.element(
  screen.getByArticleTitle('Hello World')
).toBeVisible()
```

## Configuration

You can configure [Vue Test Utils](https://test-utils.vuejs.org/api/#config) options by assigning properties to the `config` export (available in both `vitest-browser-vue` and `vitest-browser-vue/pure`):

```js
import { config } from 'vitest-browser-vue/pure'

config.global.stubs.CustomComponent = {
  template: '<div></div>',
}
```

## See also

- [Vue Testing Library documentation](https://testing-library.com/docs/vue-testing-library/intro)
