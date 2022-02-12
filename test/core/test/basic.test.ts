import { assert, expect, it, suite, test } from 'vitest'
import { two } from '../src/submodule'
import { timeout } from '../src/timeout'

test('mess process', () => {
  // eslint-disable-next-line no-global-assign
  process = 1 as any
  expect(process).toBe(1)
})

test('Math.sqrt()', async() => {
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

const hi = suite('suite')

hi.test('expect truthy', () => {
  expect({}).toBeTruthy()
  expect(null).not.toBeTruthy()
})

// Remove .skip to test async fail by timeout
test.skip('async with timeout', async() => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve()
    }, 200)
  })
}, 100)

it('timeout', () => new Promise(resolve => setTimeout(resolve, timeout)))

function callbackTest(name: string, doneValue: any) {
  let callbackAwaited = false

  it(`callback setup ${name}`, (done) => {
    setTimeout(() => {
      expect({}).toBeTruthy()
      callbackAwaited = true
      done(doneValue)
    }, 20)
  })

  it(`callback test ${name}`, () => {
    expect(callbackAwaited).toBe(true)
  })
}

callbackTest('success ', undefined)

callbackTest('success done(false)', false)
