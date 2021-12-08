import { it, describe, assert } from 'vitest'

describe.skip('skipped suite', () => {
  it('no fail as suite is skipped', () => {
    assert.equal(Math.sqrt(4), 3)
  })
})

describe.todo('unimplemented suite')

describe('task modes', () => {
  it.skip('no fail as it task is skipped', () => {
    assert.equal(Math.sqrt(4), 3)
  })

  it.todo('unimplemented task')
})

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

describe('concurrent tasks', () => {
  let count = 0

  const counterTest = (c: number) => async() => {
    assert.equal(count, c)
    await delay(20)
    count++
  }

  it('s1', counterTest(0))

  // it.concurrent.skip('concurrent-skip', counterTest(-1))
  // it.skip.concurrent('skip-concurrent', counterTest(-1))

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
