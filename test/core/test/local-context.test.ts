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
  it.only('is chainable with implicit type', (context: LocalTestContext) => {
    expect(context.bar).toBe('bar')
  })
})
