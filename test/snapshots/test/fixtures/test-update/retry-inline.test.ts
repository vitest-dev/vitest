import { expect, test } from 'vitest'

test('inline repeats', { repeats: 1 }, () => {
  expect('foo').toMatchInlineSnapshot(`"foo"`)
})

test('inline retry', { retry: 1 }, (ctx) => {
  expect('foo').toMatchInlineSnapshot(`"foo"`)
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('boom')
  }
})
