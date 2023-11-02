import { beforeEach, describe, expect, it } from 'vitest'

describe('local test context works with explicit type', () => {
  interface LocalTestContext {
    foo: string
  }
  beforeEach<LocalTestContext>((context) => {
    context.foo = 'foo'
  })
  it<LocalTestContext>('works with explicit type', (context) => {
    expect(context.foo).toBe('foo')
  })
  it.todo.skip<LocalTestContext>('is chainable with explicit type', (context) => {
    expect(context.foo).toBe('foo')
  })
})

describe('local test context works with implicit type', () => {
  interface LocalTestContext {
    bar: string
  }
  beforeEach((context: LocalTestContext) => {
    context.bar = 'bar'
  })
  it('works with implicit type', (context: LocalTestContext) => {
    expect(context.bar).toBe('bar')
  })
  it('is chainable with implicit type', (context: LocalTestContext) => {
    expect(context.bar).toBe('bar')
  })
})

describe('context expect', () => {
  it('has snapshotState', ({ expect: localExpect }) => {
    expect(expect.getState().snapshotState).toBeDefined()
    expect(localExpect.getState().snapshotState).toBeDefined()
  })
})

describe('custom matcher are inherited by local context', () => {
  expect.extend({
    toFooTest() {
      return {
        pass: true,
        message: () => `foo`,
      }
    },
  })

  it('basic', ({ expect: localExpect }) => {
    // as assertion
    expect(expect('test')).toHaveProperty('toFooTest')
    expect(expect.soft('test')).toHaveProperty('toFooTest')
    expect(localExpect('test')).toHaveProperty('toFooTest')
    expect(localExpect.soft('test')).toHaveProperty('toFooTest')

    // as asymmetric matcher
    expect(expect).toHaveProperty('toFooTest')
    expect(expect.not).toHaveProperty('toFooTest')
    expect(localExpect).toHaveProperty('toFooTest')
    expect(localExpect.not).toHaveProperty('toFooTest')
  })
})
