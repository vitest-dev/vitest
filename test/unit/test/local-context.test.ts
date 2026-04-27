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
    toEqual_testCustom(received, expected) {
      return {
        pass: received === expected,
        message: () => `test`,
      }
    },
  })

  it('basic', ({ expect: localExpect }) => {
    // as assertion
    expect(expect('test')).toHaveProperty('toEqual_testCustom')
    expect(expect.soft('test')).toHaveProperty('toEqual_testCustom')
    expect(localExpect('test')).toHaveProperty('toEqual_testCustom')
    expect(localExpect.soft('test')).toHaveProperty('toEqual_testCustom')

    // as asymmetric matcher
    expect(expect).toHaveProperty('toEqual_testCustom')
    expect(expect.not).toHaveProperty('toEqual_testCustom')
    expect(localExpect).toHaveProperty('toEqual_testCustom')
    expect(localExpect.not).toHaveProperty('toEqual_testCustom');

    (expect(0) as any).toEqual_testCustom(0);
    (expect(0) as any).not.toEqual_testCustom(1);
    (localExpect(0) as any).toEqual_testCustom(0);
    (localExpect(0) as any).not.toEqual_testCustom(1)

    expect(0).toEqual((expect as any).toEqual_testCustom(0))
    localExpect(0).toEqual((localExpect as any).toEqual_testCustom(0))
    expect(0).toEqual((expect.not as any).toEqual_testCustom(1))
    localExpect(0).toEqual((localExpect.not as any).toEqual_testCustom(1))

    // asymmetric matcher function is identical
    expect((expect as any).toEqual_testCustom).toBe((localExpect as any).toEqual_testCustom)
    expect((expect.not as any).toEqual_testCustom).toBe((localExpect.not as any).toEqual_testCustom)
  })
})
