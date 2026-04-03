import { expect, test } from 'vitest'
import { kvAdapter } from '../domain/basic'

expect.addSnapshotDomain(kvAdapter)

// --- TEST CASES ---
test('all literal', () => {
  expect({ name: 'alice', age: '30' }).toMatchDomainInlineSnapshot(`
    name=alice
    age=30
  `, 'kv')
})

test('with regex', () => {
  expect({ name: 'bob', score: '999', status: 'active' }).toMatchDomainInlineSnapshot(`
    name=bob
    score=/\\d+/
    status=active
  `, 'kv')
})
