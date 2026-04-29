import { afterAll, afterEach, assert, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { timeout } from '../src/timeout'

describe.skip('skipped suite', () => {
  beforeAll(() => {
    throw new Error('should not run')
  })

  beforeEach(() => {
    throw new Error('should not run')
  })

  afterEach(() => {
    throw new Error('should not run')
  })

  afterAll(() => {
    throw new Error('should not run')
  })

  it('no fail as suite is skipped', () => {
    assert.equal(Math.sqrt(4), 3)
  })
})

describe.todo('unimplemented suite')

describe('test modes', () => {
  it.skip('no fail as it test is skipped', () => {
    assert.equal(Math.sqrt(4), 3)
  })

  it.todo('unimplemented test')
})

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe('concurrent tests', () => {
  let count = 0

  const counterTest = (c: number) => async () => {
    assert.equal(count, c)
    await delay(20)
    count++
  }

  it('s1', counterTest(0))

  it.concurrent.skip('concurrent-skip', counterTest(-1))
  it.skip.concurrent('skip-concurrent', counterTest(-1))

  it.concurrent('c1', counterTest(1))
  it.concurrent('c2', counterTest(1))
  it.concurrent('c3', counterTest(1))

  it('s2', counterTest(4))
  it('s2', counterTest(5))

  it.concurrent('c4', counterTest(6))
  it.concurrent('c5', counterTest(6))

  it.concurrent.todo('concurrent-todo')
  it.todo.concurrent('todo-concurrent')
})

describe.concurrent('concurrent suite', () => {
  let count = 0

  const counterTest = (c: number) => async () => {
    assert.equal(count, c)
    await delay(20)
    count++
  }

  it('s1', counterTest(0))

  it.concurrent.skip('concurrent-skip', counterTest(-1))
  it.skip.concurrent('skip-concurrent', counterTest(-1))

  it.concurrent('c1', counterTest(0))
  it.concurrent('c2', counterTest(0))
  it.concurrent('c3', counterTest(0))

  it('s2', counterTest(0))
  it('s2', counterTest(0))

  it.concurrent('c4', counterTest(0))
  it.concurrent('c5', counterTest(0))

  it.concurrent.todo('concurrent-todo')
  it.todo.concurrent('todo-concurrent')
})

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))

describe('test.only in nested described', () => {
  describe('nested describe', () => {
    it('skipped test', () => {
      assert.equal(Math.sqrt(4), 3) // doesn't fails, as the next is it.only
    })
    it.only('focus test. Should fails', () => {
      assert.equal(Math.sqrt(4), 2)
    })
  })
})

it.fails('should fails', () => {
  expect(1).toBe(2)
})
