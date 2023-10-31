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

describe('custom matcher inherited from global to local', () => {
  expect.extend({
    testCustomInheritance() {
      return {
        pass: true,
        message: () => `foo`,
      }
    },
  })

  it('basic', ({ expect: localExpect }) => {
    // as assertion
    expect(expect('test')).toHaveProperty('testCustomInheritance')
    expect(localExpect('test')).toHaveProperty('testCustomInheritance')

    // as asymmetric matcher
    expect(expect).toHaveProperty('testCustomInheritance')

    // TODO: not working
    // expect(localExpect).toHaveProperty('testCustomInheritance')
  })
})
