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
    return `value:${captured}`
  },
  parseExpected(input) {
    return input.trim()
  },
  match(captured, expected) {
    if (typeof expected === 'string' && expected.startsWith('/') && expected.endsWith('/')) {
      const pass = new RegExp(expected.slice(1, -1)).test(captured)
      return {
        pass,
        actual: pass ? expected : captured,
        message: pass ? undefined : `Domain mismatch: expected ${expected}, got ${captured}`,
        mismatches: pass
          ? []
          : [{
              path: '$',
              reason: 'regex-no-match',
              expected,
              actual: captured,
            }],
      }
    }
    return {
      pass: captured === expected,
    }
  },
}

expect.addSnapshotDomain(testDomainAdapter)

test('matches domain snapshot with semantic matcher', () => {
  expect('hello 123').toMatchDomainInlineSnapshot('test-domain', `"value:hello 123"`)
})

test('matches domain snapshot file entry', () => {
  expect('hello 456').toMatchDomainSnapshot('test-domain')
})


test.skip('throws for unknown domain', () => {
  expect('hello').toMatchDomainInlineSnapshot('unknown-domain', 'hello')
})

test.skip('attaches domain match diagnostics on mismatch', () => {
  expect('hello').toMatchDomainInlineSnapshot('test-domain', ``)
})
