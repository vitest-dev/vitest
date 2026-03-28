import { expect, test } from 'vitest'

test('cyclic properties mismatch', () => {
  const received: Record<string, any> = { name: 'alice' }
  received.self = received

  const properties: Record<string, any> = { name: 'bob' }
  properties.self = properties

  expect(received).toMatchSnapshot(properties)
})
