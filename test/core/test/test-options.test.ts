import { describe, expect, test } from 'vitest'

const fail = () => expect.fail('expected to be skipped')

describe('all test variations are allowed', () => {
  test('skipped by default')

  test.skip('skipped explicitly', fail)
  test.skip('skipped explicitly', fail, 1000)
  test('skipped explicitly via options', { skip: true }, fail)
  test('skipped explicitly via options as the last argument', fail, { skip: true })

  test.todo('todo explicitly', fail)
  test.todo('todo explicitly', fail, 1000)
  test('todo explicitly via options', { todo: true }, fail)
  test('todo explicitly via options as the last argument', fail, { todo: true })

  test.fails('fails by default', fail)
  test.fails('fails by default', fail, 1000)
  test('fails explicitly via options', { fails: true }, fail)
  test('fails explicitly via options as the last argument', fail, { fails: true })
})

describe('only is allowed explicitly', () => {
  test('not only by default', fail)
  test.only('only explicitly', () => {})
})

describe('only is allowed via options', () => {
  test('not only by default', fail)
  test('only via options', { only: true }, () => {})
})

describe('only is allowed via option as the last argument', () => {
  test('not only by default', fail)
  test('only via options as the last argument', () => {}, { only: true })
})
