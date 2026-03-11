import type { DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'
import type { AriaNode, AriaTemplateRoleNode } from './aria'
import { captureAriaTree, matchAriaTree, parseAriaTemplate, renderAriaTree } from './aria'

export const ariaDomainAdapter: DomainSnapshotAdapter<AriaNode, AriaTemplateRoleNode> = {
  name: 'aria',

  capture(received) {
    if (received instanceof Element)
      return captureAriaTree(received)
    if (typeof received === 'string') {
      document.body.innerHTML = received
      return captureAriaTree(document.body)
    }
    throw new TypeError('aria adapter expects an Element or HTML string')
  },

  render(captured) {
    return `\n${renderAriaTree(captured)}\n`
  },

  parseExpected(input) {
    return parseAriaTemplate(input.trim())
  },

  match(captured, expected): DomainMatchResult {
    if (typeof expected === 'string')
      expected = parseAriaTemplate(expected.trim())
    const pass = matchAriaTree(captured, expected)
    return {
      pass,
      message: pass ? undefined : 'ARIA tree does not match expected template',
    }
  },
}
