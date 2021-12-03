import { test, assert } from '../src'

test('Math.sqrt()', () => {
  assert.equal(Math.sqrt(4), 2)
  assert.equal(Math.sqrt(144), 12)
  assert.equal(Math.sqrt(2), Math.SQRT2)
})

test('JSON', () => {
  const input = {
    foo: 'hello',
    bar: 'world',
  }

  const output = JSON.stringify(input)

  // assert.(output, '{"foo":"hello","bar":"world"}')
  assert.equal(JSON.parse(output), input, 'matches original')
})
