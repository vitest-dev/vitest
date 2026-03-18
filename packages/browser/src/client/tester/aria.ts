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
import * as yaml from 'yaml'

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
    return parseAriaTemplate(yaml, input.trim())
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
