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

export const ariaSnapshotAdapter: DomainSnapshotAdapter<AriaNode, AriaTemplateNode> = {
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
    return {
      pass: r.pass,
      message: r.pass ? undefined : 'ARIA tree does not match expected template',
      resolved: r.pass ? undefined : wrapNewlines(r.resolved),
      expected: r.pass ? undefined : wrapNewlines(renderAriaTemplate(expected)),
    }
  },
}

// ensure newlines for diff/snapshot readability
function wrapNewlines(s: string) {
  return `\n${s}\n`
}
