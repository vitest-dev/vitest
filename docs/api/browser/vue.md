---
outline: deep
---

# vitest-browser-vue

The community [`vitest-browser-vue`](https://www.npmjs.com/package/vitest-browser-vue) package renders [Vue](https://vuejs.org/) components in [Browser Mode](/guide/browser/).

```ts
import { render } from 'vitest-browser-vue'
import { expect, test } from 'vitest'

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

The package exposes two entry points: `vitest-browser-vue` and `vitest-browser-vue/pure`. They exposes identical API, but the `pure` entry point doesn't add a handler to remove the component before the next test has started.

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

By default, Vitest will create a `div` and append it to the `document.body` and this is where your component will be rendered. If you provide your own `HTMLElement` container via this option, it will not be appended to the `document.body` automatically.

For example, if you are unit testing a `tablebody` element, it cannot be a child of a `div`. In this case, you can specify a `table` as the render container.

```jsx
const table = document.createElement('table')

const { container } = render(TableBody, {
  props,
  container: document.body.appendChild(table),
})
```

#### baseElement

If the `container` is specified, then this defaults to that, otherwise this defaults to `document.body`. This is used as the base element for the queries as well as what is printed when you use `debug()`.

### locator

The [locator](/api/browser/locators) of your `container`. It is useful to use queries scoped only to your component, or pass it down to other assertions:

```jsx
import { render } from 'vitest-browser-vue'

const { locator } = render(NumberDisplay, {
  props: { number: 2 }
})

await locator.getByRole('button').click()
await expect.element(locator).toHaveTextContent('Hello World')
```

### debug

```ts
export function debug(
  el?: HTMLElement | HTMLElement[] | Locator | Locator[],
  maxLength?: number,
  options?: PrettyDOMOptions,
): void
```

This method is a shortcut for `console.log(prettyDOM(baseElement))`. It will print the DOM content of the container or specified elements to the console.

## cleanup

```ts
export function cleanup(): void
```

Remove all components rendered with [`render`](#render).

## Extend Queries

To extend locator queries, see [`"Custom Locators"`](/api/browser/locators#custom-locators). For example, to make `render` return a new custom locator, define it using the `locators.extend` API:

```jsx {5-7,12}
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
