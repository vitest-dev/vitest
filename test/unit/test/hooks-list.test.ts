import * as vitest from 'vitest'
import { describe, expect, test, vi } from 'vitest'

vi.setConfig({
  sequence: {
    hooks: 'list',
  },
})

const hookOrder: string[] = []
function callHook(hook: 'beforeAll' | 'beforeEach' | 'afterAll' | 'afterEach', order: number) {
  vitest[hook](() => {
    hookOrder.push(`${hook} #${order}`)
  })
}

describe('hooks are called as list', () => {
  vitest.beforeAll(() => {
    hookOrder.push(`beforeAll #1`)

    return function beforeAllCleanup() {
      hookOrder.push(`beforeAllCleanup #1`)
    }
  })
  callHook('beforeAll', 2)
  callHook('beforeAll', 3)

  callHook('afterAll', 1)
  // will wait for it
  vitest.afterAll(async () => {
    await Promise.resolve()
    hookOrder.push(`afterAll #2`)
  })
  callHook('afterAll', 3)

  vitest.beforeEach(() => {
    hookOrder.push(`beforeEach #1`)

    return function beforeEachCleanup() {
      hookOrder.push(`beforeEachCleanup #1`)
    }
  })

  callHook('beforeEach', 2)
  callHook('beforeEach', 3)

  callHook('afterEach', 1)
  callHook('afterEach', 2)

  test('before hooks pushed in order', () => {
    expect(hookOrder).toEqual([
      'beforeAll #1',
      'beforeAll #2',
      'beforeAll #3',

      'beforeEach #1',
      'beforeEach #2',
      'beforeEach #3',
    ])
  })
})

describe('previous suite run all hooks', () => {
  test('after all hooks run in defined order', () => {
    expect(hookOrder).toEqual([
      'beforeAll #1',
      'beforeAll #2',
      'beforeAll #3',

      'beforeEach #1',
      'beforeEach #2',
      'beforeEach #3',

      'afterEach #1',
      'afterEach #2',

      'beforeEachCleanup #1',

      'afterAll #1',
      'afterAll #2',
      'afterAll #3',

      'beforeAllCleanup #1',
    ])
  })
})
