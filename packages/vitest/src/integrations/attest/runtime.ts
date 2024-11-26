import type { ChaiPlugin } from '@vitest/expect'
import {
  type Plugin as PrettyFormatPlugin,
  PrettyFormatSkipSnapshotError,
} from '@vitest/pretty-format'
import { addSerializer, stripSnapshotIndentation } from '@vitest/snapshot'
import { parseStacktrace } from '@vitest/utils/source-map'
import * as chai from 'chai'
import { getSnapshotClient, getTestNames } from '../snapshot/chai'

// lazy load '@ark/attest` only when enabled
let lib: typeof import('@ark/attest')
let enabled = false

const plugin: ChaiPlugin = (chai, utils) => {
  function getTypeAssertions(ctx: object) {
    const parsed = parseStacktrace(utils.flag(ctx, '__vitest_expect_stack'))
    const location = parsed[0]
    const types = lib.getTypeAssertionsAtPosition({
      file: location.file,
      method: location.method,
      line: location.line,
      char: location.column,
    })
    return types
  }

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeSnapshot',
    function (
      this: Record<string, unknown>,
      message?: string,
    ) {
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].args[0].type
      }
      utils.flag(this, '_name', 'toMatchTypeSnapshot')
      const test = utils.flag(this, 'vitest-test')
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        error: utils.flag(this, 'error'),
        errorMessage: utils.flag(this, 'message'),
        ...getTestNames(test),
      })
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeInlineSnapshot',
    function __INLINE_SNAPSHOT__(
      this: Record<string, unknown>,
      inlineSnapshot?: string,
      message?: string,
    ) {
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].args[0].type
      }
      utils.flag(this, '_name', 'toMatchTypeInlineSnapshot')
      const isNot = utils.flag(this, 'negate')
      if (isNot) {
        throw new Error('toMatchTypeInlineSnapshot cannot be used with "not"')
      }
      const test = utils.flag(this, 'vitest-test')
      const isInsideEach = test && (test.each || test.suite?.each)
      if (isInsideEach) {
        throw new Error(
          'InlineSnapshot cannot be used inside of test.each or describe.each',
        )
      }
      if (inlineSnapshot) {
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        error: utils.flag(this, 'error'),
        errorMessage: utils.flag(this, 'message'),
        isInline: true,
        inlineSnapshot,
        ...getTestNames(test),
      })
    },
  )
}

class AttestSnapshotWrapper {
  constructor(public value?: unknown) {}
}

const prettyFormatPlugin: PrettyFormatPlugin = {
  test(val: unknown) {
    return !!(val && val instanceof AttestSnapshotWrapper)
  },
  serialize(val: AttestSnapshotWrapper, config, indentation, depth, refs, printer) {
    if (!enabled) {
      throw new PrettyFormatSkipSnapshotError()
    }
    if (typeof val.value === 'string') {
      return val.value
    }
    return printer(
      val.value,
      config,
      indentation,
      depth,
      refs,
    )
  },
}

export async function setupAttest() {
  chai.use(plugin)
  addSerializer(prettyFormatPlugin)
  // TODO: vitest config
  enabled = !!globalThis.process?.env.VITEST_ATTEST
  if (enabled) {
    lib = await import('@ark/attest')
  }
}
