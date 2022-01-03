import { expect, test } from 'vitest'

test('snapshot', () => {
  expect({
    this: { is: new Set(['of', 'snapshot']) },
  }).toMatchSnapshot()
})

test('inline snapshot', () => {
  expect('inline string').toMatchInlineSnapshot('"inline string"')
  expect({ foo: { type: 'object', map: new Map() } }).toMatchInlineSnapshot(`
{
  "foo": {
    "map": Map {},
    "type": "object",
  },
}`)
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
