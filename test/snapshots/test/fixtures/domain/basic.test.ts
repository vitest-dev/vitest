import type { DomainSnapshotAdapter } from '@vitest/snapshot'
import { expect, test } from 'vitest'

const testDomainAdapter: DomainSnapshotAdapter<string, string> = {
  name: 'test-domain',
  capture(received) {
    if (typeof received !== 'string') {
      throw new TypeError('test-domain expects a string')
    }
    return received
  },
  render(captured) {
    return `custom:${captured}`
  },
  parseExpected(input) {
    const trimmed = input.trim()
    return trimmed.startsWith('custom:') ? trimmed.slice('custom:'.length) : trimmed
  },
  match(captured, expected) {
    if (typeof expected === 'string' && expected.startsWith('/') && expected.endsWith('/')) {
      const pass = new RegExp(expected.slice(1, -1)).test(captured)
      return {
        pass,
        message: pass ? undefined : `Domain mismatch: expected ${expected}, got ${captured}`,
      }
    }
    return {
      pass: captured === expected,
    }
  },
}

expect.addSnapshotDomain(testDomainAdapter)

test('literal', () => {
  expect('hello 123').toMatchDomainSnapshot('test-domain')
})

test('regex', () => {
  expect('world 456').toMatchDomainSnapshot('test-domain')
})

test('mixed', () => {
  expect('foo 789').toMatchDomainSnapshot('test-domain')
  expect('bar 012').toMatchDomainSnapshot('test-domain')
})
