---
title: Testing Types | Guide
---

# Testing Types

Vitest allows you to write tests for your types.

Under the hood Vitest calls `tsc` or `vue-tsc`, depending on your config, and parses results.

```ts
// TODO write normal tests examples
import { describe, expectTypeOf, test } from 'vitest'

describe('test', () => {
  test('some-test', () => {
    expectTypeOf(45).toBe(45)
  })

  describe('test2', () => {
    test('some-test 2', () => {
      expectTypeOf(45).toBe(45)
    })
  })
})

expectTypeOf({ wolk: 'true' }).toHaveProperty('wolk')
```