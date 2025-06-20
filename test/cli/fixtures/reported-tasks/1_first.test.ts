import { describe, expect, it } from 'vitest'

it('runs a test', async () => {
  await new Promise(r => setTimeout(r, 10))
  expect(1).toBe(1)
})

it('fails a test', async () => {
  await new Promise(r => setTimeout(r, 10))
  expect(1).toBe(2)
})

it('fails multiple times', () => {
  expect.soft(1).toBe(2)
  expect.soft(3).toBe(3)
  expect.soft(2).toBe(3)
})

it('skips an option test', { skip: true })
it.skip('skips a .modifier test')
it('skips an ctx.skip() test', (ctx) => ctx.skip())

it('todos an option test', { todo: true })
it.todo('todos a .modifier test')

it('retries a test', { retry: 5 }, () => {
  expect(1).toBe(2)
})

let counter = 0
it('retries a test with success', { retry: 5 }, () => {
  expect(counter++).toBe(2)
})

it('repeats a test', { repeats: 5 }, () => {
  expect(1).toBe(2)
})

describe('a group', () => {
  it('runs a test in a group', () => {
    expect(1).toBe(1)
  })

  it('todos an option test in a group', { todo: true })

  describe('a nested group', () => {
    it('runs a test in a nested group', () => {
      expect(1).toBe(1)
    })

    it('fails a test in a nested group', () => {
      expect(1).toBe(2)
    })

    it.concurrent('runs first concurrent test in a nested group', () => {
      expect(1).toBe(1)
    })

    it.concurrent('runs second concurrent test in a nested group', () => {
      expect(1).toBe(1)
    })
  })
})

describe.todo('todo group', () => {
  it('test inside todo group', () => {})
})

describe.skip('skipped group', () => {
  it('test inside skipped group', () => {})
})

describe.shuffle('shuffled group', () => {
  it('runs a test in a shuffled group', () => {
    expect(1).toBe(1)
  })
})

describe.each([1])('each group %s', (groupValue) => {
  it.each([2])('each test %s', (itValue) => {
    expect(groupValue + itValue).toBe(3)
  })
})

it('registers a metadata', (ctx) => {
  ctx.task.meta.key = 'value'
})

declare module 'vitest' {
  interface TaskMeta {
    key?: string
  }
}
