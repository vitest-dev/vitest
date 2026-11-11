import { expect, test } from 'vitest'

let nextUserId = 1

// the replay fails with another id, because the first run changed the next id
test('the first user gets the id 1', { repeats: 1 }, ({ random }) => {
  const user = { id: nextUserId++, name: random.pick(['ada', 'grace', 'linus']) }
  expect(user.id).toBe(1)
})
