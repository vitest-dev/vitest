import { expect, test } from 'vitest'

test('repro', () => {
  expect(0).toBe(0)
})

test('inline same title', () => {
  expect('foo').toMatchInlineSnapshot(`"foo"`)
})

test('inline same title', () => {
  expect('bar').toMatchInlineSnapshot(`"bar"`)
})

test('file same title', () => {
  expect('foo').toMatchSnapshot()
})

test('file same title', () => {
  expect('bar').toMatchSnapshot()
})
