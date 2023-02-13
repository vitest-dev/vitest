import * as vitest from 'vitest'
import { describe, expect, test, vi } from 'vitest'

vi.setConfig({
  sequence: {
    hooks: 'list',
  },
})

const hookOrder: number[] = []
function callHook(hook: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach', order: number) {
  vitest[hook](() => {
    hookOrder.push(order)
  })
}

describe('hooks are called as list', () => {
  callHook('beforeAll', 1)
  callHook('beforeAll', 2)
  callHook('beforeAll', 3)

  callHook('afterAll', 4)
  // will wait for it
  vitest.afterAll(async () => {
    await Promise.resolve()
    hookOrder.push(5)
  })
  callHook('afterAll', 6)

  callHook('beforeEach', 7)
  callHook('beforeEach', 8)
  callHook('beforeEach', 9)

  callHook('afterEach', 10)
  callHook('afterEach', 11)
  callHook('afterEach', 12)

  test('before hooks pushed in order', () => {
    expect(hookOrder).toEqual([1, 2, 3, 7, 8, 9])
  })
})

describe('previous suite run all hooks', () => {
  test('after all hooks run in defined order', () => {
    expect(hookOrder).toEqual([1, 2, 3, 7, 8, 9, 10, 11, 12, 4, 5, 6])
  })
})
