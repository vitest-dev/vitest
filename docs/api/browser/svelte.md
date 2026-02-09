---
outline: deep
---

# vitest-browser-svelte

The community [`vitest-browser-svelte`](https://www.npmjs.com/package/vitest-browser-svelte) package renders [Svelte](https://svelte.dev/) components in [Browser Mode](/guide/browser/).

```ts
import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import Component from './Component.svelte'

test('counter button increments the count', async () => {
  const screen = render(Component, {
    initialCount: 1,
  })

  await screen.getByRole('button', { name: 'Increment' }).click()

  await expect.element(screen.getByText('Count is 2')).toBeVisible()
})
```

::: warning
This library takes inspiration from [`@testing-library/svelte`](https://github.com/testing-library/svelte-testing-library).

If you have used `@testing-library/svelte` in your tests before, you can keep using it, however the `vitest-browser-svelte` package provides certain benefits unique to the Browser Mode that `@testing-library/svelte` lacks:

`vitest-browser-svelte` returns APIs that interact well with built-in [locators](/api/browser/locators), [user events](/api/browser/interactivity) and [assertions](/api/browser/assertions): for example, Vitest will automatically retry the element until the assertion is successful, even if it was rerendered between the assertions.
:::

The package exposes two entry points: `vitest-browser-svelte` and `vitest-browser-svelte/pure`. They expose identical API, but the `pure` entry point doesn't add a handler to remove the component before the next test has started.

## render

```ts
export function render<C extends Component>(
  Component: ComponentImport<C>,
  options?: ComponentOptions<C>,
  renderOptions?: SetupOptions
): RenderResult<C>
```

### Options

The `render` function supports either options that you can pass down to [`mount`](https://svelte.dev/docs/svelte/imperative-component-api#mount) or props directly:

```ts
const screen = render(Component, {
  props: { // [!code --]
    initialCount: 1, // [!code --]
  }, // [!code --]
  initialCount: 1, // [!code ++]
})
```

#### props

Component props.

#### target

By default, Vitest will create a `div`, append it to `document.body`, and render your component there. If you provide your own `HTMLElement` container, it will not be appended automatically — you'll need to call `document.body.appendChild(container)` before `render`.

For example, if you are unit testing a `tbody` element, it cannot be a child of a `div`. In this case, you can specify a `table` as the render container.

```ts
const table = document.createElement('table')

const screen = render(TableBody, {
  props,
  // ⚠️ appending the element to `body` manually before rendering
  target: document.body.appendChild(table),
})
```

#### baseElement

This can be passed down in a third argument. You should rarely, if ever, need to use this option.

If the `target` is specified, then this defaults to that, otherwise this defaults to `document.body`. This is used as the base element for the queries as well as what is printed when you use `debug()`.

### Render Result

In addition to documented return value, the `render` function also returns all available [locators](/api/browser/locators) relative to the [`baseElement`](#baseelement), including [custom ones](/api/browser/locators#custom-locators).

```ts
const screen = render(TableBody, props)

await screen.getByRole('link', { name: 'Expand' }).click()
```

#### container

The containing DOM node where your Svelte component is rendered. This is a regular DOM node, so you technically could call `container.querySelector` etc. to inspect the children.

:::danger
If you find yourself using `container` to query for rendered elements then you should reconsider! The [locators](/api/browser/locators) are designed to be more resilient to changes that will be made to the component you're testing. Avoid using `container` to query for elements!
:::

#### component

The mounted Svelte component instance. You can use this to access component methods and properties if needed.

```ts
const { component } = render(Counter, {
  initialCount: 0,
})

// Access component exports if needed
```

#### locator

The [locator](/api/browser/locators) of your `container`. It is useful to use queries scoped only to your component, or pass it down to other assertions:

```ts
import { render } from 'vitest-browser-svelte'

const { locator } = render(NumberDisplay, {
  number: 2,
})

await locator.getByRole('button').click()
await expect.element(locator).toHaveTextContent('Hello World')
```

#### debug

```ts
function debug(
  el?: HTMLElement | HTMLElement[] | Locator | Locator[],
): void
```

This method is a shortcut for `console.log(prettyDOM(baseElement))`. It will print the DOM content of the container or specified elements to the console.

#### rerender

```ts
function rerender(props: Partial<ComponentProps<T>>): void
```

Updates the component's props and waits for Svelte to apply the changes. Use this to test how your component responds to prop changes.

```ts
import { render } from 'vitest-browser-svelte'

const { rerender } = render(NumberDisplay, {
  number: 1,
})

// re-render the same component with different props
await rerender({ number: 2 })
```

#### unmount

```ts
function unmount(): void
```

Unmount and destroy the Svelte component. This is useful for testing what happens when your component is removed from the page (like testing that you don't leave event handlers hanging around causing memory leaks).

```ts
import { render } from 'vitest-browser-svelte'

const { container, unmount } = render(Component)
unmount()
// your component has been unmounted and now: container.innerHTML === ''
```

## cleanup

```ts
export function cleanup(): void
```

Remove all components rendered with [`render`](#render).

## Extend Queries

To extend locator queries, see [`"Custom Locators"`](/api/browser/locators#custom-locators). For example, to make `render` return a new custom locator, define it using the `locators.extend` API:

```ts {5-7,12}
import { locators } from 'vitest/browser'
import { render } from 'vitest-browser-svelte'

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

## Snippets

For simple snippets, you can use a wrapper component and "dummy" children to test them. Setting `data-testid` attributes can be helpful when testing slots in this manner.

::: code-group
```ts [basic.test.js]
import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'

import SubjectTest from './basic-snippet.test.svelte'

test('basic snippet', async () => {
  const screen = render(SubjectTest)

  const heading = screen.getByRole('heading')
  const child = heading.getByTestId('child')

  await expect.element(child).toBeInTheDocument()
})
```
```svelte [basic-snippet.svelte]
<script>
  let { children } = $props()
</script>

<h1>
  {@render children?.()}
</h1>
```
```svelte [basic-snippet.test.svelte]
<script>
  import Subject from './basic-snippet.svelte'
</script>

<Subject>
  <span data-testid="child"></span>
</Subject>
```
:::

For more complex snippets, e.g. where you want to check arguments, you can use Svelte's [`createRawSnippet`](https://svelte.dev/docs/svelte/svelte#createRawSnippet) API.

::: code-group
```js [complex-snippet.test.js]
import { render } from 'vitest-browser-svelte'
import { createRawSnippet } from 'svelte'
import { expect, test } from 'vitest'

import Subject from './complex-snippet.svelte'

test('renders greeting in message snippet', async () => {
  const screen = render(Subject, {
    name: 'Alice',
    message: createRawSnippet(greeting => ({
      render: () => `<span data-testid="message">${greeting()}</span>`,
    })),
  })

  const message = screen.getByTestId('message')

  await expect.element(message).toHaveTextContent('Hello, Alice!')
})
```
```svelte [complex-snippet.svelte]
<script>
  let { name, message } = $props()

  const greeting = $derived(`Hello, ${name}!`)
</script>

<p>
  {@render message?.(greeting)}
</p>
```
:::

## See also

- [Svelte Testing Library documentation](https://testing-library.com/docs/svelte-testing-library/intro)
- [Svelte Testing Library examples](https://github.com/testing-library/svelte-testing-library/tree/main/examples)
