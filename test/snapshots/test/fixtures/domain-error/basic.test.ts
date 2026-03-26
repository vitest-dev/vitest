import { expect, test } from 'vitest'
import { kvAdapter } from '../domain/basic'

expect.addSnapshotDomain(kvAdapter)

test('file', () => {
  expect({ name: 'alice', age: '30' }).toMatchDomainSnapshot('kv')
})

test('inline', () => {
  expect({ name: 'alice', age: '30' }).toMatchDomainInlineSnapshot(`
    name=bob
    inine-broken
  `, 'kv')
})
