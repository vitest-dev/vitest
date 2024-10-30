import { expect, test } from 'vitest'

test('repro', () => {
  expect(0).toBe(0)
})

test('inline repeats', { repeats: 1 }, () => {
  expect('foo').toMatchInlineSnapshot(`"foo"`)
})

test('inline retry', { retry: 1 }, (ctx) => {
  expect('foo').toMatchInlineSnapshot(`"foo"`)
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('boom')
  }
})

// test('foo', { retry: 1 }, () => {
//   expect('foo').toMatchSnapshot()
// });
