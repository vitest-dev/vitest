import { assert, expect, it, suite, test } from 'vitest'
import { two } from '../src/submodule'
import { timeout } from '../src/timeout'

const testPath = expect.getState().testPath
if (!testPath || !testPath.includes('basic.test.ts')) {
  throw new Error(`testPath is not correct: ${testPath}`)
}

test('Math.sqrt()', async () => {
  assert.equal(Math.sqrt(4), two)
  assert.equal(Math.sqrt(2), Math.SQRT2)
  expect(Math.sqrt(144)).toStrictEqual(12)
  // await new Promise(resolve => setTimeout(resolve, 3000))
})

test('JSON', () => {
  const input = {
    foo: 'hello',
    bar: 'world',
  }

  const output = JSON.stringify(input)

  expect(input).toEqual({
    foo: 'hello',
    bar: 'world',
  })
  expect(output).toEqual('{"foo":"hello","bar":"world"}')
  assert.deepEqual(JSON.parse(output), input, 'matches original')
})

test('mode and NODE_ENV is test by default', () => {
  expect(process.env.NODE_ENV).toBe('test')
  // expect(import.meta.env.MODE).toBe('test') TODO: support in strict mode(?)
})

test('assertion is callable', () => {
  const str = '13'
  expect(str).to.be.a('string')
  expect(str).not.to.be.a('number')
})

const hi = suite('suite')

hi.test('expect truthy', () => {
  expect({}).toBeTruthy()
  expect(null).not.toBeTruthy()
})

// Remove .skip to test async fail by timeout
test.skip('async with timeout', async () => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, 200)
  })
}, 100)

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))

it.fails('deprecated done callback', (done) => {
  // @ts-expect-error deprecated done callback is not typed
  done()
})

test('escaping', () => {
  expect(['\\123']).toEqual(['\\123'])
  expect('\\123').toEqual('\\123')
})
