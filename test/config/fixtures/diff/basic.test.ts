import { expect, test } from 'vitest'

test('large diff', () => {
  const data = `
a
b
c
d
e
`
  expect(data.repeat(6)).toEqual(`here${data.repeat(3)}and${data.repeat(3)}there`)
})
