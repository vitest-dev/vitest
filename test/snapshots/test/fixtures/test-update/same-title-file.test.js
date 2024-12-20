import { expect, test } from 'vitest'

test('same title exist', () => {
  // correct entry exists in .snap
  expect('a').toMatchSnapshot()
})

test('same title exist', () => {
  // wrong entry exists in .snap
  expect('b').toMatchSnapshot()
})

test('same title new', () => {
  expect('a').toMatchSnapshot()
})

test('same title new', () => {
  expect('b').toMatchSnapshot()
  expect('c').toMatchSnapshot()
})
