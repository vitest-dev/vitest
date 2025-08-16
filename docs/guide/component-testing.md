---
title: Component Testing | Guide
outline: deep
---

# Component Testing

Vitest provides comprehensive support for component testing across multiple frameworks including Vue, React, Svelte, Lit, Marko, and more. Component testing allows you to test your UI components in isolation, ensuring they render correctly, handle user interactions, and maintain expected behavior.

## Overview

Component testing in Vitest can be done in two ways:

1. **Browser Mode** (Recommended) - Run tests in a real browser environment
2. **Node.js with DOM simulation** - Using jsdom or happy-dom for faster execution

For the most accurate testing experience, we recommend using [Browser Mode](/guide/browser/) as it provides a real browser environment where your components actually run.

## Browser Mode Component Testing

Browser Mode is the recommended approach for component testing as it provides the most accurate testing environment. Your tests run in real browsers using providers like Playwright, WebdriverIO, or preview mode.

### Setup

The easiest way to get started with browser mode is using Vitest's init command:

```bash
vitest init browser
```

This will automatically install the necessary dependencies and configure your project for browser testing.

Alternatively, you can set it up manually:

::: code-group
```bash [npm]
npm install --save-dev @vitest/browser playwright
```

```bash [yarn]
yarn add --dev @vitest/browser playwright
```

```bash [pnpm]
pnpm add -D @vitest/browser playwright
```
:::

Then configure browser mode in your `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
  },
})
```

### Framework-specific Packages

Vitest provides official rendering packages for popular frameworks:

| Framework | Package | Description |
|-----------|---------|-------------|
| Vue | `vitest-browser-vue` | For Vue.js components |
| React | `vitest-browser-react` | For React components |
| Svelte | `vitest-browser-svelte` | For Svelte components |

Community packages are also available:

| Framework | Package | Maintainer |
|-----------|---------|------------|
| Lit | [`vitest-browser-lit`](https://www.npmjs.com/package/vitest-browser-lit) | Community |
| Preact | [`vitest-browser-preact`](https://www.npmjs.com/package/vitest-browser-preact) | Community |
| Qwik | [`vitest-browser-qwik`](https://www.npmjs.com/package/vitest-browser-qwik) | Community |

### Examples by Framework

#### Vue Components

Install the Vue testing package:

```bash
npm install --save-dev vitest-browser-vue
```

```vue
<!-- HelloWorld.vue -->
<script setup lang="ts">
defineProps<{
  name: string
}>()
</script>

<template>
  <div>
    <h1>Hello {{ name }}!</h1>
  </div>
</template>
```

```ts
// HelloWorld.test.ts
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-vue'
import HelloWorld from './HelloWorld.vue'

test('renders name', async () => {
  const { getByText } = render(HelloWorld, {
    props: { name: 'Vitest' },
  })
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
```

#### React Components

Install the React testing package:

```bash
npm install --save-dev vitest-browser-react
```

```tsx
// HelloWorld.tsx
export default function HelloWorld({ name }: { name: string }) {
  return (
    <div>
      <h1>
        Hello
        {' '}
        {name}
        !
      </h1>
    </div>
  )
}
```

```tsx
// HelloWorld.test.tsx
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import HelloWorld from './HelloWorld.tsx'

test('renders name', async () => {
  const { getByText } = render(<HelloWorld name="Vitest" />)
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
```

#### Svelte Components

Install the Svelte testing package:

```bash
npm install --save-dev vitest-browser-svelte
```

```svelte
<!-- HelloWorld.svelte -->
<script lang="ts">
  export let name: string
</script>

<h1>Hello {name}!</h1>
```

```ts
// HelloWorld.test.ts
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-svelte'
import HelloWorld from './HelloWorld.svelte'

test('renders name', async () => {
  const { getByText } = render(HelloWorld, { name: 'Vitest' })
  await expect.element(getByText('Hello Vitest!')).toBeInTheDocument()
})
```

#### Lit Components

Install the community Lit testing package:

```bash
npm install --save-dev vitest-browser-lit
```

```ts
// HelloWorld.ts
import { html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('hello-world')
export class HelloWorld extends LitElement {
  @property({ type: String })
  name = 'World'

  render() {
    return html`<h1>Hello ${this.name}!</h1>`
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'hello-world': HelloWorld
  }
}
```

```ts
// HelloWorld.test.ts
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-lit'
import { html } from 'lit'
import './HelloWorld.js'

test('renders name', async () => {
  const screen = render(html`<hello-world name="Vitest"></hello-world>`)
  const element = screen.getByText('Hello Vitest!')
  await expect.element(element).toBeInTheDocument()
})
```

## User Interactions

Test user interactions using Vitest's locator methods:

```js
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import { page } from '@vitest/browser/context'
import LoginForm from './LoginForm'

test('handles form submission', async () => {
  render(<LoginForm />)

  // Fill form fields
  await page.getByLabelText(/username/i).fill('john_doe')
  await page.getByLabelText(/password/i).fill('secret123')

  // Submit form
  await page.getByRole('button', { name: /submit/i }).click()

  // Assert results
  await expect.element(page.getByText('Login successful')).toBeInTheDocument()
})
```

## Assertions

Vitest provides DOM-specific assertions for component testing:

```ts
import { expect } from 'vitest'

// Element presence
await expect.element(getByText('Hello')).toBeInTheDocument()
await expect.element(queryByText('Missing')).not.toBeInTheDocument()

// Element properties
await expect.element(getByRole('button')).toBeEnabled()
await expect.element(getByRole('button')).toBeDisabled()

// Text content
await expect.element(getByRole('heading')).toHaveTextContent('Welcome')

// Attributes
await expect.element(getByTestId('link')).toHaveAttribute('href', '/home')

// CSS classes and styles
await expect.element(getByTestId('alert')).toHaveClass('error')
await expect.element(getByTestId('box')).toHaveStyle({ color: 'red' })
```

## Testing Library Integration

For frameworks not officially supported by Vitest, you can use Testing Library packages:

```jsx
// For Solid.js components
import { render } from '@testing-library/solid'
import { page } from '@vitest/browser/context'

test('solid component test', async () => {
  const { baseElement } = render(() => <MyComponent />)
  const screen = page.elementLocator(baseElement)

  await expect.element(screen.getByText('Hello')).toBeInTheDocument()
})
```

## Node.js Component Testing

For faster execution during development, you can test components in Node.js using DOM simulation:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom', // or 'jsdom'
  },
})
```

::: warning
Node.js testing with DOM simulation may not catch all browser-specific issues. Use Browser Mode for comprehensive testing.
:::

## Best Practices

1. **Use Browser Mode for CI/CD** - Ensures tests run in real browser environments
2. **Test user interactions** - Simulate real user behavior with clicks, typing, etc.
3. **Test accessibility** - Ensure components are accessible to all users
4. **Mock external dependencies** - Focus tests on component logic, not external services
5. **Use meaningful test descriptions** - Make test intent clear for maintainability

## Common Patterns

### Testing Props and Events

```js
test('emits events on user interaction', async () => {
  const mockHandler = vi.fn()
  render(<Button onClick={mockHandler}>Click me</Button>)

  await page.getByRole('button').click()

  expect(mockHandler).toHaveBeenCalledOnce()
})
```

### Testing Conditional Rendering

```jsx
test('shows loading state', async () => {
  const { getByText, rerender } = render(<DataComponent loading={true} />)

  await expect.element(getByText('Loading...')).toBeInTheDocument()

  rerender(<DataComponent loading={false} data="content" />)

  await expect.element(getByText('content')).toBeInTheDocument()
})
```

### Testing Forms

```jsx
test('validates form input', async () => {
  render(<ContactForm />)

  const emailInput = page.getByLabelText(/email/i)

  await emailInput.fill('invalid-email')
  // Trigger validation by focusing away from the input
  await page.getByRole('button', { name: /submit/i }).click()

  await expect.element(page.getByText('Please enter a valid email')).toBeInTheDocument()
})
```

## Debugging Component Tests

1. **Use browser dev tools** - Browser Mode allows full debugging capabilities
2. **Add debug statements** - Use `console.log` and breakpoints
3. **Inspect rendered output** - Check if components render as expected
4. **Verify selectors** - Ensure element queries target correct elements

## Migration from Other Testing Frameworks

### From Jest + Testing Library

Most Jest + Testing Library tests work with minimal changes:

```ts
// Before (Jest)
import { render, screen } from '@testing-library/react'

// After (Vitest)
import { render } from 'vitest-browser-react'
```

### Key Differences

- Use `await expect.element()` instead of `expect()` for DOM assertions
- Use `@vitest/browser/context` for user interactions instead of `@testing-library/user-event`
- Browser Mode provides real browser environment vs. jsdom simulation

## Learn More

- [Browser Mode Documentation](/guide/browser/)
- [Assertion API](/guide/browser/assertion-api)
- [Interactivity API](/guide/browser/interactivity-api)
- [Example Repository](https://github.com/vitest-tests/browser-examples)
