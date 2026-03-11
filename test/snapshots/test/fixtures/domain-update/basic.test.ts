import type { DomainSnapshotAdapter } from '@vitest/snapshot'
import { expect, test } from 'vitest'

const testDomainAdapter: DomainSnapshotAdapter<string, string> = {
  name: 'test-domain-update',
  capture(received) {
    if (typeof received !== 'string') {
      throw new TypeError('test-domain-update expects a string')
    }
    return received
  },
  render(captured) {
    return `value:${captured}`
  },
  parseExpected(input) {
    return input.trim()
  },
  match(captured, expected) {
    const rendered = `value:${captured}`
    return {
      pass: rendered === expected,
    }
  },
}

expect.addSnapshotDomain(testDomainAdapter)

// TODO: inline snapshot path
// test('updates inline domain snapshot', () => {
//   expect('hello 999').toMatchDomainInlineSnapshot('test-domain-update')
// })
