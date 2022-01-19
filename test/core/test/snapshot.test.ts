import { describe, expect, test } from 'vitest'
import { deepMergeSnapshot } from '../../../packages/vitest/src/integrations/snapshot/port/utils'
import { testOutsideInlineSnapshot } from './snapshots-outside'

test('snapshot', () => {
  expect({
    this: { is: new Set(['of', 'snapshot']) },
  }).toMatchSnapshot()
})

test('outside snapshot', () => {
  testOutsideInlineSnapshot()
})

test('inline snapshot', () => {
  expect('inline string').toMatchInlineSnapshot('"inline string"')
  expect({ foo: { type: 'object', map: new Map() } }).toMatchInlineSnapshot(`
    {
      "foo": {
        "map": Map {},
        "type": "object",
      },
    }
  `)
  const indent = `
()=>
  array
    .map(fn)
    .filter(fn)
`
  expect(indent)
    .toMatchInlineSnapshot(`
      "
      ()=>
        array
          .map(fn)
          .filter(fn)
      "
    `)
})

test('snapshot with big array', () => {
  expect({
    this: { is: new Set(['one', new Array(30).fill({})]) },
  }).toMatchSnapshot()
})

test('snapshot with big string', () => {
  expect({
    this: { is: new Set(['one', new Array(30).fill('zoo').join()]) },
  }).toMatchSnapshot()
})

test('throwing snapshots', () => {
  expect(() => {
    throw new Error('omega')
  }).toThrowErrorMatchingSnapshot()

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'omega'
  }).toThrowErrorMatchingSnapshot()

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw { error: 'omega' }
  }).toThrowErrorMatchingSnapshot()
})

test('throwing inline snapshots', () => {
  expect(() => {
    throw new Error('omega')
  }).toThrowErrorMatchingInlineSnapshot('"omega"')

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'omega'
  }).toThrowErrorMatchingInlineSnapshot('"omega"')

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw { error: 'omega' }
  }).toThrowErrorMatchingInlineSnapshot(`
    {
      "error": "omega",
    }
    `)
})

test('properties snapshot', () => {
  const user = {
    createdAt: new Date(),
    id: Math.floor(Math.random() * 20),
    name: 'LeBron James',
  }

  expect(user).toMatchSnapshot({
    createdAt: expect.any(Date),
    id: expect.any(Number),
    name: expect.stringContaining('LeBron'),
  })
})

test.fails('properties snapshot fails', () => {
  const user = {
    createdAt: new Date(),
    id: Math.floor(Math.random() * 20),
    name: 'LeBron James',
  }

  expect(user).toMatchSnapshot({
    createdAt: expect.any(Date),
    id: expect.any(String),
  })
})

test('properties inline snapshot', () => {
  const user = {
    createdAt: new Date(),
    id: Math.floor(Math.random() * 20),
    name: 'LeBron James',
  }

  expect(user).toMatchInlineSnapshot({
    createdAt: expect.any(Date),
    id: expect.any(Number),
  }, `
    {
      "createdAt": Any<Date>,
      "id": Any<Number>,
      "name": "LeBron James",
    }
    `)
})

describe('utils test', () => {
  test('deepMergeSnapshot considers asymmetric matcher', () => {
    class Test {
      zoo = 'zoo'
      get bar() {
        return 'name'
      }
    }

    const obj = deepMergeSnapshot({
      regexp: /test/,
      test: new Test(),
      name: 'name',
      foo: 5,
      array: [/test/, 'test'],
    }, {
      name: expect.stringContaining('name'),
      foo: 88,
      array: [/test2/],
      test: { baz: 'baz' },
    })

    expect(obj.regexp instanceof RegExp).toBe(true)
    expect(obj.test instanceof Test).toBe(false)
    expect(obj.array[0] instanceof RegExp).toBe(false)

    expect(obj).toEqual({
      regexp: /test/,
      test: { baz: 'baz', zoo: 'zoo' },
      name: expect.stringContaining('name'),
      foo: 88,
      array: [{}, 'test'],
    })
  })
})
