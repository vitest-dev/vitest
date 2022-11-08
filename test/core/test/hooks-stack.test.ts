import * as vitest from 'vitest'
import { describe, expect, test, vi } from 'vitest'

vi.setConfig({
  sequence: {
    hooks: 'stack',
  },
})

const hookOrder: number[] = []
function callHook(hook: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach', order: number) {
  vitest[hook](() => {
    hookOrder.push(order)
  })
}

describe('hooks are called sequentially', () => {
  callHook('beforeAll', 1)
  callHook('afterAll', 4)

  callHook('beforeAll', 2)
  // will wait for it
  vitest.afterAll(async () => {
    await Promise.resolve()
    hookOrder.push(5)
  })

  callHook('beforeEach', 7)
  callHook('afterEach', 10)

  callHook('beforeEach', 8)
  callHook('afterEach', 11)

  test('before hooks pushed in order', () => {
    expect(hookOrder).toEqual([1, 2, 7, 8])
  })
})

describe('previous suite run all hooks', () => {
  test('after all hooks run in reverse order', () => {
    expect(hookOrder).toEqual([1, 2, 7, 8, 11, 10, 5, 4])
  })
})
