---
title: Component Testing | Guide
outline: deep
---

# Component Testing

Component testing is a testing strategy that focuses on testing individual UI components in isolation. Unlike end-to-end tests that test entire user flows, component tests verify that each component works correctly on its own, making them faster to run and easier to debug.

Vitest provides comprehensive support for component testing across multiple frameworks including Vue, React, Svelte, Lit, Preact, Qwik, Solid, Marko, and more. This guide covers the specific patterns, tools, and best practices for testing components effectively with Vitest.

## Why Component Testing?

Component testing sits between unit tests and end-to-end tests, offering several advantages:

- **Faster feedback** - Test individual components without loading entire applications
- **Isolated testing** - Focus on component behavior without external dependencies
- **Better debugging** - Easier to pinpoint issues in specific components
- **Comprehensive coverage** - Test edge cases and error states more easily

## Browser Mode for Component Testing

Component testing in Vitest uses **Browser Mode** to run tests in real browser environments using Playwright, WebdriverIO, or preview mode. This provides the most accurate testing environment as your components run in real browsers with actual DOM implementations, CSS rendering, and browser APIs.

### Why Browser Mode?

Browser Mode is the recommended approach for component testing because it provides the most accurate testing environment. Unlike DOM simulation libraries, Browser Mode catches real-world issues that can affect your users.

::: tip
Browser Mode catches issues that DOM simulation libraries might miss, including:
- CSS layout and styling problems
- Real browser API behavior
- Accurate event handling and propagation
- Proper focus management and accessibility features

:::

### Purpose of this Guide

This guide focuses specifically on **component testing patterns and best practices** using Vitest's capabilities. While many examples use Browser Mode (as it's the recommended approach), the focus here is on component-specific testing strategies rather than browser configuration details.

For detailed browser setup, configuration options, and advanced browser features, refer to the [Browser Mode documentation](/guide/browser/).

## What Makes a Good Component Test

Good component tests focus on **behavior and user experience** rather than implementation details:

- **Test the contract** - How components receive inputs (props) and produce outputs (events, renders)
- **Test user interactions** - Clicks, form submissions, keyboard navigation
- **Test edge cases** - Error states, loading states, empty states
- **Avoid testing internals** - State variables, private methods, CSS classes

### Component Testing Hierarchy

```
1. Critical User Paths    → Always test these
2. Error Handling        → Test failure scenarios
3. Edge Cases           → Empty data, extreme values
4. Accessibility        → Screen readers, keyboard nav
5. Performance          → Large datasets, animations
```

## Component Testing Strategies

### Isolation Strategy

Test components in isolation by mocking dependencies:

```tsx
// Mock external services
vi.mock('../api/userService', () => ({
  fetchUser: vi.fn().mockResolvedValue({ name: 'John' })
}))

// Mock child components to focus on parent logic
vi.mock('../components/UserCard', () => ({
  default: vi.fn(({ user }) => `<div>User: ${user.name}</div>`)
}))

test('UserProfile handles loading and data states', async () => {
  const { getByText } = render(<UserProfile userId="123" />)

  // Test loading state
  expect(getByText('Loading...')).toBeInTheDocument()

  // Wait for data to load
  await waitFor(() => {
    expect(getByText('User: John')).toBeInTheDocument()
  })
})
```

### Integration Strategy

Test component collaboration and data flow:

```tsx
test('ProductList filters and displays products correctly', async () => {
  const mockProducts = [
    { id: 1, name: 'Laptop', category: 'Electronics', price: 999 },
    { id: 2, name: 'Book', category: 'Education', price: 29 }
  ]

  const { getByLabelText, getByText } = render(
    <ProductList products={mockProducts} />
  )

  // Initially shows all products
  expect(getByText('Laptop')).toBeInTheDocument()
  expect(getByText('Book')).toBeInTheDocument()

  // Filter by category
  await userEvent.selectOptions(
    getByLabelText(/category/i),
    'Electronics'
  )

  // Only electronics should remain
  expect(getByText('Laptop')).toBeInTheDocument()
  expect(queryByText('Book')).not.toBeInTheDocument()
})
```

## Testing Library Integration

While Vitest provides official packages for popular frameworks ([`vitest-browser-vue`](https://www.npmjs.com/package/vitest-browser-vue), [`vitest-browser-react`](https://www.npmjs.com/package/vitest-browser-react), [`vitest-browser-svelte`](https://www.npmjs.com/package/vitest-browser-svelte)), you can integrate with [Testing Library](https://testing-library.com/) for frameworks not yet officially supported.

### When to Use Testing Library

- Your framework doesn't have an official Vitest browser package yet
- You're migrating existing tests that use Testing Library
- You prefer Testing Library's API for specific testing scenarios

### Integration Pattern

The key is using `page.elementLocator()` to bridge Testing Library's DOM output with Vitest's browser mode APIs:

```jsx
// For Solid.js components
import { render } from '@testing-library/solid'
import { page } from '@vitest/browser/context'

test('Solid component handles user interaction', async () => {
  // Use Testing Library to render the component
  const { baseElement, getByRole } = render(() =>
    <Counter initialValue={0} />
  )

  // Bridge to Vitest's browser mode for interactions and assertions
  const screen = page.elementLocator(baseElement)

  // You can use either Testing Library queries or Vitest's page queries
  const incrementButton = getByRole('button', { name: /increment/i })

  // Use Vitest's assertions and interactions
  await expect.element(screen.getByText('Count: 0')).toBeInTheDocument()

  // Trigger user interaction using Vitest's page API
  await page.elementLocator(incrementButton).click()

  await expect.element(screen.getByText('Count: 1')).toBeInTheDocument()
})
```

### Available Testing Library Packages

Popular Testing Library packages that work well with Vitest:

- [`@testing-library/solid`](https://github.com/solidjs/solid-testing-library) - For Solid.js
- [`@marko/testing-library`](https://testing-library.com/docs/marko-testing-library/intro) - For Marko
- [`@testing-library/svelte`](https://testing-library.com/docs/svelte-testing-library/intro) - Alternative to [`vitest-browser-svelte`](https://www.npmjs.com/package/vitest-browser-svelte)
- [`@testing-library/vue`](https://testing-library.com/docs/vue-testing-library/intro) - Alternative to [`vitest-browser-vue`](https://www.npmjs.com/package/vitest-browser-vue)

::: tip Migration Path
If your framework gets official Vitest support later, you can gradually migrate by replacing Testing Library's `render` function while keeping most of your test logic intact.
:::

## Best Practices

### 1. Use Browser Mode for CI/CD
Ensure tests run in real browser environments for the most accurate testing. Browser Mode provides accurate CSS rendering, real browser APIs, and proper event handling.

### 2. Test User Interactions
Simulate real user behavior using Vitest's [Interactivity API](/guide/browser/interactivity-api). Use `page.getByRole()` and `userEvent` methods as shown in our [Advanced Testing Patterns](#advanced-testing-patterns):

```tsx
// Good: Test actual user interactions
await page.getByRole('button', { name: /submit/i }).click()
await page.getByLabelText(/email/i).fill('user@example.com')

// Avoid: Testing implementation details
// component.setState({ email: 'user@example.com' })
```

### 3. Test Accessibility
Ensure components work for all users by testing keyboard navigation, focus management, and ARIA attributes. See our [Testing Accessibility](#testing-accessibility) example for practical patterns:

```tsx
// Test keyboard navigation
await userEvent.keyboard('{Tab}')
expect(document.activeElement).toBe(nextFocusableElement)

// Test ARIA attributes
expect(modal).toHaveAttribute('aria-modal', 'true')
```

### 4. Mock External Dependencies
Focus tests on component logic by mocking APIs and external services. This makes tests faster and more reliable. See our [Isolation Strategy](#isolation-strategy) for examples:

```tsx
// Mock API calls
vi.mock('../api/userService', () => ({
  fetchUser: vi.fn().mockResolvedValue({ name: 'John' })
}))

// Mock child components when testing parent logic
vi.mock('../components/UserCard', () => ({
  default: vi.fn(() => <div>Mocked UserCard</div>)
}))
```

### 5. Use Meaningful Test Descriptions
Write test descriptions that explain the expected behavior, not implementation details:

```tsx
// Good: Describes user-facing behavior
test('shows error message when email format is invalid')
test('disables submit button while form is submitting')

// Avoid: Implementation-focused descriptions
test('calls validateEmail function')
test('sets isSubmitting state to true')
```

## Advanced Testing Patterns

### Testing Component State Management

```tsx
// Testing stateful components and state transitions
test('ShoppingCart manages items correctly', async () => {
  const { getByText, getByTestId } = render(<ShoppingCart />)

  // Initially empty
  await expect.element(getByText('Your cart is empty')).toBeInTheDocument()

  // Add item
  await page.getByRole('button', { name: /add laptop/i }).click()

  // Verify state change
  await expect.element(getByText('1 item')).toBeInTheDocument()
  await expect.element(getByText('Laptop - $999')).toBeInTheDocument()

  // Test quantity updates
  await page.getByRole('button', { name: /increase quantity/i }).click()
  await expect.element(getByText('2 items')).toBeInTheDocument()
})
```

### Testing Async Components with Data Fetching

```tsx
// Mock the API to test different scenarios
const mockUserApi = vi.fn()
vi.mock('../api/users', () => ({ getUser: mockUserApi }))

test('UserProfile handles loading, success, and error states', async () => {
  // Test loading state
  mockUserApi.mockImplementation(() => new Promise(() => {})) // Never resolves

  const { getByText, rerender } = render(<UserProfile userId="123" />)
  await expect.element(getByText('Loading user...')).toBeInTheDocument()

  // Test success state
  mockUserApi.mockResolvedValue({ name: 'John Doe', email: 'john@example.com' })
  rerender(<UserProfile userId="123" />)

  await waitFor(() => {
    expect(getByText('John Doe')).toBeInTheDocument()
    expect(getByText('john@example.com')).toBeInTheDocument()
  })

  // Test error state
  mockUserApi.mockRejectedValue(new Error('User not found'))
  rerender(<UserProfile userId="999" />)

  await waitFor(() => {
    expect(getByText('Error: User not found')).toBeInTheDocument()
  })
})
```

### Testing Component Communication

```tsx
// Test parent-child component interaction
test('parent and child components communicate correctly', async () => {
  const mockOnSelectionChange = vi.fn()

  const { getByText } = render(
    <ProductCatalog onSelectionChange={mockOnSelectionChange}>
      <ProductFilter />
      <ProductGrid />
    </ProductCatalog>
  )

  // Interact with child component
  await page.getByRole('checkbox', { name: /electronics/i }).click()

  // Verify parent receives the communication
  expect(mockOnSelectionChange).toHaveBeenCalledWith({
    category: 'electronics',
    filters: ['electronics']
  })

  // Verify other child component updates
  await waitFor(() => {
    expect(getByText('Showing Electronics products')).toBeInTheDocument()
  })
})
```

### Testing Complex Forms with Validation

```tsx
test('ContactForm handles complex validation scenarios', async () => {
  const mockSubmit = vi.fn()
  const { getByLabelText, getByText } = render(
    <ContactForm onSubmit={mockSubmit} />
  )

  const nameInput = page.getByLabelText(/full name/i)
  const emailInput = page.getByLabelText(/email/i)
  const messageInput = page.getByLabelText(/message/i)
  const submitButton = page.getByRole('button', { name: /send message/i })

  // Test validation triggers
  await submitButton.click()

  await expect.element(getByText('Name is required')).toBeInTheDocument()
  await expect.element(getByText('Email is required')).toBeInTheDocument()
  await expect.element(getByText('Message is required')).toBeInTheDocument()

  // Test partial validation
  await nameInput.fill('John Doe')
  await submitButton.click()

  await expect.element(getByText('Name is required')).not.toBeInTheDocument()
  await expect.element(getByText('Email is required')).toBeInTheDocument()

  // Test email format validation
  await emailInput.fill('invalid-email')
  await submitButton.click()

  await expect.element(getByText('Please enter a valid email')).toBeInTheDocument()

  // Test successful submission
  await emailInput.clear()
  await emailInput.fill('john@example.com')
  await messageInput.fill('Hello, this is a test message.')
  await submitButton.click()

  expect(mockSubmit).toHaveBeenCalledWith({
    name: 'John Doe',
    email: 'john@example.com',
    message: 'Hello, this is a test message.'
  })
})
```

### Testing Error Boundaries

```tsx
// Test how components handle and recover from errors
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Component error!')
  }
  return <div>Component working fine</div>
}

test('ErrorBoundary catches and displays errors gracefully', async () => {
  const { getByText, rerender } = render(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <ThrowError shouldThrow={false} />
    </ErrorBoundary>
  )

  // Initially working
  await expect.element(getByText('Component working fine')).toBeInTheDocument()

  // Trigger error
  rerender(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <ThrowError shouldThrow={true} />
    </ErrorBoundary>
  )

  // Error boundary should catch it
  await expect.element(getByText('Something went wrong')).toBeInTheDocument()
})
```

### Testing Accessibility

```tsx
test('Modal component is accessible', async () => {
  const { getByRole, getByLabelText } = render(
    <Modal isOpen={true} title="Settings">
      <SettingsForm />
    </Modal>
  )

  // Test focus management - modal should receive focus when opened
  // This is crucial for screen reader users to know a modal opened
  const modal = getByRole('dialog')
  expect(document.activeElement).toBe(modal)

  // Test ARIA attributes - these provide semantic information to screen readers
  expect(modal).toHaveAttribute('aria-labelledby') // Links to title element
  expect(modal).toHaveAttribute('aria-modal', 'true') // Indicates modal behavior

  // Test keyboard navigation - Escape key should close modal
  // This is required by ARIA authoring practices
  await userEvent.keyboard('{Escape}')
  await waitFor(() => {
    expect(modal).not.toBeInTheDocument()
  })

  // Test focus trap - tab navigation should cycle within modal
  // This prevents users from tabbing to content behind the modal
  const firstInput = getByLabelText(/username/i)
  const lastButton = getByRole('button', { name: /save/i })

  firstInput.focus()
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}') // Shift+Tab goes backwards
  expect(document.activeElement).toBe(lastButton) // Should wrap to last element
})
```

## Debugging Component Tests

### 1. Use Browser Dev Tools

Browser Mode runs tests in real browsers, giving you access to full developer tools. When tests fail, you can:

- **Open browser dev tools** during test execution (F12 or right-click → Inspect)
- **Set breakpoints** in your test code or component code
- **Inspect the DOM** to see the actual rendered output
- **Check console errors** for JavaScript errors or warnings
- **Monitor network requests** to debug API calls

For headless mode debugging, add `headless: false` to your browser config temporarily.

### 2. Add Debug Statements

Use strategic logging to understand test failures:

```tsx
test('debug form validation', async () => {
  render(<ContactForm />)

  const submitButton = page.getByRole('button', { name: /submit/i })
  await submitButton.click()

  // Debug: Check what's actually rendered
  console.log('Current DOM:', document.body.innerHTML)

  // Debug: Check if element exists with different query
  const errorElement = page.getByText('Email is required')
  console.log('Error element found:', await errorElement.count())

  await expect.element(errorElement).toBeInTheDocument()
})
```

### 3. Inspect Rendered Output

When components don't render as expected, investigate systematically:

**Check the DOM structure:**
```tsx
test('debug rendering issues', async () => {
  const { container } = render(<MyComponent />)

  // Print the entire rendered HTML
  console.log('Rendered HTML:', container.innerHTML)

  // Or use Vitest's browser UI to visually inspect the component
  // The component will be visible in the browser when tests run
})
```

**Use Vitest's browser UI:**
- Run tests with browser mode enabled
- Open the browser URL shown in the terminal to see tests running
- Visual inspection helps identify CSS issues, layout problems, or missing elements

**Test element queries:**
```tsx
// Debug why elements can't be found
const button = page.getByRole('button', { name: /submit/i })
console.log('Button count:', await button.count()) // Should be 1

// Try alternative queries if the first one fails
if (await button.count() === 0) {
  console.log('All buttons:', await page.getByRole('button').all())
  console.log('By test ID:', await page.getByTestId('submit-btn').count())
}
```

### 4. Verify Selectors

Selector issues are common causes of test failures. Debug them systematically:

**Check accessible names:**
```tsx
// If getByRole fails, check what roles/names are available
const buttons = await page.getByRole('button').all()
for (const button of buttons) {
  const accessibleName = await button.getAttribute('aria-label')
    || await button.textContent()
  console.log(`Button: "${accessibleName}"`)
}
```

**Test different query strategies:**
```tsx
// Multiple ways to find the same element
const submitButton
  = page.getByRole('button', { name: /submit/i }) // By accessible name
    || page.getByTestId('submit-button') // By test ID
    || page.locator('button[type="submit"]') // By CSS selector
    || page.getByText('Submit') // By exact text
```

**Common selector debugging patterns:**
```tsx
test('debug element queries', async () => {
  render(<LoginForm />)

  // 1. Check if element exists at all
  const emailInput = page.getByLabelText(/email/i)
  console.log('Email input exists:', await emailInput.count() > 0)

  // 2. If not found, check available labels
  const labels = await page.locator('label').all()
  for (const label of labels) {
    console.log('Available label:', await label.textContent())
  }

  // 3. Check if element is hidden or disabled
  if (await emailInput.count() > 0) {
    console.log('Email input visible:', await emailInput.isVisible())
    console.log('Email input enabled:', await emailInput.isEnabled())
  }
})
```

### 5. Debugging Async Issues

Component tests often involve timing issues:

```tsx
test('debug async component behavior', async () => {
  render(<AsyncUserProfile userId="123" />)

  // Debug: Check loading state
  console.log('Loading text exists:', await page.getByText('Loading...').count())

  // Wait with timeout and debug if it fails
  try {
    await expect.element(page.getByText('John Doe')).toBeInTheDocument()
  }
  catch (error) {
    console.log('Timeout reached. Current DOM:', document.body.innerHTML)
    console.log('API calls made:', /* check your mock calls */)
    throw error
  }
})
```

## Migration from Other Testing Frameworks

### From Jest + Testing Library

Most Jest + Testing Library tests work with minimal changes:

```ts
// Before (Jest)
import { render, screen } from '@testing-library/react' // [!code --]

// After (Vitest)
import { render } from 'vitest-browser-react' // [!code ++]
```

### Key Differences

- Use `await expect.element()` instead of `expect()` for DOM assertions
- Use `@vitest/browser/context` for user interactions instead of `@testing-library/user-event`
- Browser Mode provides real browser environment for accurate testing

## Learn More

- [Browser Mode Documentation](/guide/browser/)
- [Assertion API](/guide/browser/assertion-api)
- [Interactivity API](/guide/browser/interactivity-api)
- [Example Repository](https://github.com/vitest-tests/browser-examples)
