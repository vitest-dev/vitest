import { expect, test } from 'vitest'
import { kvAdapter } from './basic'

expect.addSnapshotDomain(kvAdapter)

test('all literal', () => {
  expect({ name: 'alice', age: '30' }).toMatchDomainSnapshot('kv')
})

test('with regex', () => {
  expect({ name: 'bob', score: '999', status: 'active' }).toMatchDomainSnapshot('kv')
})
