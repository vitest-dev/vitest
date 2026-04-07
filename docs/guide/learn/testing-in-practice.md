---
title: Testing in Practice | Guide
prev:
  text: Snapshot Testing
  link: /guide/learn/snapshots
next:
  text: Debugging Tests
  link: /guide/learn/debugging-tests
---

# Testing in Practice

The previous pages covered the Vitest API: assertions, mocking, snapshots, and test lifecycle hooks. This page focuses on applying those tools to real code. It covers how to decide what to test, how to structure tests effectively, and how to organize test files as a project grows.

## What to Test

When you sit down to write tests for a function or module, start by thinking about its **contract**: what does it promise to do for the code that calls it? The contract is defined by its inputs (arguments, configuration) and its outputs (return values, side effects, errors). These are the things your tests should verify.

Consider a `formatPrice` function:

```ts [formatPrice.ts]
export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}
```

The contract here is: given an amount and a currency code, return a formatted price string. Good tests for this function would cover:

```ts [formatPrice.test.ts]
import { expect, test } from 'vitest'
import { formatPrice } from './formatPrice.js'

test('formats USD prices', () => {
  expect(formatPrice(10, 'USD')).toBe('$10.00')
})

test('formats EUR prices', () => {
  expect(formatPrice(10, 'EUR')).toMatchInlineSnapshot(`"€10.00"`)
})

test('handles zero', () => {
  expect(formatPrice(0, 'USD')).toBe('$0.00')
})

test('handles negative amounts', () => {
  expect(formatPrice(-5.5, 'USD')).toBe('-$5.50')
})

test('rounds to two decimal places', () => {
  expect(formatPrice(10.999, 'USD')).toBe('$11.00')
})
```

Notice what these tests *don't* do. They don't check which internal `Intl.NumberFormat` options were passed, or whether an intermediate variable was set. They only check the output. This is important because if someone later refactors the internals (maybe switching to a different formatting library), the tests should still pass as long as the output doesn't change.

A good rule of thumb: if someone refactors the internals but the output stays the same, should the test break? If it would, you're probably testing implementation details rather than behavior.

## Structuring a Test

Most tests follow a natural three-part structure, sometimes called "Arrange, Act, Assert":

1. **Set up** the data your test needs
2. **Call** the function or perform the action you're testing
3. **Check** that the result matches your expectations

```ts
test('removes an item from the list', () => {
  // Set up
  const list = new ShoppingList()
  list.add('milk')
  list.add('bread')

  // Act
  list.remove('milk')

  // Check
  expect(list.getItems()).toEqual(['bread'])
})
```

You don't need comments labeling each section. The structure becomes natural once you've written a few tests. The important thing is keeping each test focused on one behavior. If you find yourself writing "and" in a test name ("formats price and handles errors and logs the result"), that's a sign you should split it into separate tests.

Speaking of names: write test names that describe the behavior, not the implementation. "returns formatted price for USD" is better than "calls Intl.NumberFormat with correct options". When a test fails, the name should tell you what broke without having to read the test body.

## Testing Edge Cases

After covering the main behavior, think about the boundaries. What happens at the edges? What inputs are unusual but valid? What should happen when things go wrong?

Here's an example with a `parseAge` function that takes user input and returns a number:

```ts [parseAge.ts]
export function parseAge(input: string): number {
  const age = Number(input)
  if (Number.isNaN(age) || age < 0 || age > 150) {
    throw new Error(`Invalid age: ${input}`)
  }
  return Math.floor(age)
}
```

The happy path is straightforward, but the edge cases are where bugs hide:

```ts [parseAge.test.ts]
import { expect, test } from 'vitest'
import { parseAge } from './parseAge.js'

test('parses a valid age', () => {
  expect(parseAge('25')).toBe(25)
})

test('rounds down decimal ages', () => {
  expect(parseAge('25.9')).toBe(25)
})

test('handles zero', () => {
  expect(parseAge('0')).toBe(0)
})

test('handles the upper boundary', () => {
  expect(parseAge('150')).toBe(150)
})

test('throws for negative numbers', () => {
  expect(() => parseAge('-1')).toThrow('Invalid age: -1')
})

test('throws for numbers above 150', () => {
  expect(() => parseAge('151')).toThrow('Invalid age: 151')
})

test('throws for non-numeric strings', () => {
  expect(() => parseAge('abc')).toThrow('Invalid age: abc')
})

test('throws for empty string', () => {
  expect(() => parseAge('')).toThrow('Invalid age: ')
})
```

You don't need to test every possible input. Focus on the boundaries (0, 150, 151, -1), the error paths, and the types of inputs your function might realistically receive. If you're unsure whether an edge case matters, ask yourself: could a real user or a real caller trigger this? If yes, test it.

For functions with a wide range of valid inputs, manually choosing edge cases can only go so far. **Property-based testing** is a technique where you describe the *properties* that should hold for any input, and the testing framework generates hundreds of random inputs to try to find one that breaks. For example, you might say "for any valid age string, `parseAge` should return a non-negative integer" and let the tool find the counterexample. [fast-check](https://fast-check.dev/) is a popular property-based testing library that integrates well with Vitest. It's an advanced technique, but worth knowing about as your testing needs grow.

## When to Mock

Mocking is a powerful tool, but it's easy to overuse. Here are some guidelines for when mocking makes sense:

**Mock things that are slow.** Network requests, file system operations, and database calls can make your tests take seconds instead of milliseconds. Replace them with mocks to keep the feedback loop fast. For HTTP requests specifically, consider using [Mock Service Worker](https://mswjs.io/) instead of mocking fetch directly. See the [Mocking Requests](/guide/mocking/requests) guide for setup instructions.

**Mock things that are non-deterministic.** If your code depends on the current date, a random number, or a UUID generator, mock those to make your tests predictable. Vitest provides [`vi.useFakeTimers()`](/api/vi#vi-usefaketimers) and [`vi.setSystemTime()`](/api/vi#vi-setsystemtime) for controlling time in tests.

**Don't mock the thing you're testing.** This sounds obvious, but it's a common mistake. If you're testing a `UserService`, don't mock the `UserService`. Mock its *dependencies* (the database, the email sender) and let the service itself run for real.

**Prefer real implementations when they're fast and reliable.** If a dependency is a simple in-memory data structure or a pure function, there's no reason to mock it. The closer your tests are to real usage, the more confidence they give you. Only reach for mocks when the real thing is slow, flaky, or has side effects you can't control in a test.

## Organizing Test Files

There's no single right way to organize tests, but some patterns scale better than others.

The simplest starting point is one test file per source file. For every `utils.ts`, there's a `utils.test.ts` right next to it. This makes it easy to find the tests for any given piece of code, and most editors will show them side by side in the file tree:

```
src/
  utils.ts
  utils.test.ts
  formatPrice.ts
  formatPrice.test.ts
```

Some teams prefer a separate `__tests__` or `test` directory instead. Either approach works. The important thing is consistency across the project. Vitest's [`include`](/config/include) pattern matches both layouts by default.

When a module exports multiple functions, use `describe` blocks to group the tests for each one. This keeps the test output organized and makes it clear which function a failing test belongs to:

```ts
describe('formatPrice', () => {
  test('formats USD prices', () => { /* ... */ })
  test('handles zero', () => { /* ... */ })
})

describe('parseAmount', () => {
  test('parses valid amounts', () => { /* ... */ })
  test('throws for invalid input', () => { /* ... */ })
})
```

Avoid nesting `describe` blocks more than one or two levels deep. Deeply nested test trees are hard to read and usually mean the source module is doing too many things at once.

As a project grows, some test files will inevitably get long. If a test file grows beyond a few hundred lines, consider splitting it by theme or feature area. For example, `userService.test.ts` might become `userService.creation.test.ts` and `userService.auth.test.ts`. This also makes it faster to run a subset of tests during development.

Test names matter more than you might expect. When a test fails in CI, the name is often the first thing someone reads. Names like "works correctly" or "handles edge case" don't tell you what broke. Prefer names that describe the specific behavior: "returns 0 for an empty cart", "throws if the email format is invalid", "preserves existing items when adding a new one". The test output should read like a specification of what the module does.

## A Worked Example

Let's put it all together. Here's a small `TodoList` module:

```ts [todoList.ts]
export interface Todo {
  id: number
  text: string
  completed: boolean
}

let nextId = 1

export function createTodoList() {
  const items: Todo[] = []

  return {
    add(text: string): Todo {
      if (!text.trim()) {
        throw new Error('Todo text cannot be empty')
      }
      const todo = { id: nextId++, text, completed: false }
      items.push(todo)
      return todo
    },

    remove(id: number): void {
      const index = items.findIndex(item => item.id === id)
      if (index === -1) {
        throw new Error(`Todo with id ${id} not found`)
      }
      items.splice(index, 1)
    },

    toggle(id: number): void {
      const todo = items.find(item => item.id === id)
      if (!todo) {
        throw new Error(`Todo with id ${id} not found`)
      }
      todo.completed = !todo.completed
    },

    getAll(): readonly Todo[] {
      return items
    },

    getCompleted(): readonly Todo[] {
      return items.filter(item => item.completed)
    },
  }
}
```

Looking at this code, we can identify the behaviors to test:

- Adding items (the main purpose)
- Adding empty items (should fail)
- Removing items by ID
- Removing items that don't exist (should fail)
- Toggling completion status
- Getting all items vs. completed items

Here's how the test file might look:

```ts [todoList.test.ts]
import { describe, expect, test } from 'vitest'
import { createTodoList } from './todoList.js'

describe('add', () => {
  test('adds a new todo', () => {
    const list = createTodoList()
    const todo = list.add('Buy groceries')

    expect(todo.text).toBe('Buy groceries')
    expect(todo.completed).toBe(false)
    expect(list.getAll()).toHaveLength(1)
  })

  test('assigns unique IDs to each todo', () => {
    const list = createTodoList()
    const first = list.add('First')
    const second = list.add('Second')

    expect(first.id).not.toBe(second.id)
  })

  test('throws when text is empty', () => {
    const list = createTodoList()
    expect(() => list.add('')).toThrow('Todo text cannot be empty')
  })

  test('throws when text is only whitespace', () => {
    const list = createTodoList()
    expect(() => list.add('   ')).toThrow('Todo text cannot be empty')
  })
})

describe('remove', () => {
  test('removes a todo by ID', () => {
    const list = createTodoList()
    const todo = list.add('Buy groceries')

    list.remove(todo.id)

    expect(list.getAll()).toHaveLength(0)
  })

  test('keeps other items when removing one', () => {
    const list = createTodoList()
    const first = list.add('First')
    list.add('Second')

    list.remove(first.id)

    expect(list.getAll()).toHaveLength(1)
    expect(list.getAll()[0].text).toBe('Second')
  })

  test('throws when ID does not exist', () => {
    const list = createTodoList()
    expect(() => list.remove(999)).toThrow('Todo with id 999 not found')
  })
})

describe('toggle', () => {
  test('marks a todo as completed', () => {
    const list = createTodoList()
    const todo = list.add('Buy groceries')

    list.toggle(todo.id)

    expect(list.getAll()[0].completed).toBe(true)
  })

  test('toggles back to incomplete', () => {
    const list = createTodoList()
    const todo = list.add('Buy groceries')

    list.toggle(todo.id)
    list.toggle(todo.id)

    expect(list.getAll()[0].completed).toBe(false)
  })

  test('throws when ID does not exist', () => {
    const list = createTodoList()
    expect(() => list.toggle(999)).toThrow('Todo with id 999 not found')
  })
})

describe('getCompleted', () => {
  test('returns only completed todos', () => {
    const list = createTodoList()
    const buy = list.add('Buy groceries')
    list.add('Clean house')
    list.toggle(buy.id)

    const completed = list.getCompleted()

    expect(completed).toHaveLength(1)
    expect(completed[0].text).toBe('Buy groceries')
  })

  test('returns empty array when nothing is completed', () => {
    const list = createTodoList()
    list.add('Buy groceries')

    expect(list.getCompleted()).toHaveLength(0)
  })
})
```

Each `describe` block focuses on one method. Each test verifies one specific behavior. The test names read like a specification of what the module does. And if any of these tests fail, the name and the assertion will tell you exactly what broke.

Notice that we create a fresh `createTodoList()` in every test. This keeps tests independent, which means they can run in any order without affecting each other. If you find yourself repeating the same setup in every test, that's a good candidate for [`beforeEach`](/api/hooks#beforeeach) or a [`test.extend`](/guide/test-context#extend-test-context) fixture.

---

If you're building a web application and want to test components in a real browser environment, check out [Component Testing](/guide/browser/component-testing) for testing React, Vue, Svelte, and other UI frameworks.
