import type { MatchersObject } from '@vitest/expect'
import type { DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'
import type {
  AriaNode,
  AriaTemplateNode,
} from 'ivya/aria'
import {
  generateAriaTree,
  matchAriaTree,
  parseAriaTemplate,
  renderAriaTemplate,
  renderAriaTree,
} from 'ivya/aria'
import { toMatchDomainInlineSnapshot, toMatchDomainSnapshot } from 'vitest/internal/browser'

const ariaSnapshotAdapter: DomainSnapshotAdapter<AriaNode, AriaTemplateNode> = {
  name: 'aria',

  capture(received) {
    if (received instanceof Element) {
      return generateAriaTree(received)
    }
    throw new TypeError('aria adapter expects an Element')
  },

  render(captured) {
    return wrapNewlines(renderAriaTree(captured))
  },

  parseExpected(input) {
    // increase limit so that yaml parse error can reach `toMatchAriaSnapshot` callsite in user test files
    const limit = Error.stackTraceLimit
    Error.stackTraceLimit = limit + 20
    try {
      return parseAriaTemplate(input.trim())
    }
    finally {
      Error.stackTraceLimit = limit
    }
  },

  match(captured, expected): DomainMatchResult {
    const r = matchAriaTree(captured, expected)
    if (r.pass) {
      return { pass: true }
    }
    return {
      pass: false,
      message: 'Accessibility tree does not match expected template',
      resolved: wrapNewlines(r.resolved),
      expected: wrapNewlines(renderAriaTemplate(expected)),
    }
  },
}

// ensure newlines for diff/snapshot readability
function wrapNewlines(s: string) {
  return `\n${s}\n`
}

export const ariaMatchers: MatchersObject = {
  toMatchAriaSnapshot(actual: unknown) {
    return toMatchDomainSnapshot.call(this, ariaSnapshotAdapter, actual)
  },
  toMatchAriaInlineSnapshot(actual: Element, inlineSnapshot?: string) {
    return toMatchDomainInlineSnapshot.call(this, ariaSnapshotAdapter, actual, inlineSnapshot)
  },
}

for (const matcher of Object.values(ariaMatchers)) {
  Object.assign(matcher, {
    __vitest_poll_takeover__: true,
  })
}
