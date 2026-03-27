import { expect, it } from 'vitest'

it('with properties', () => {
  const age = process.env.TEST_BREAK_PROPERTIES ? 'thirty' : 30
  expect({ name: 'alice', age }).toMatchSnapshot({ age: expect.any(Number) })
})
