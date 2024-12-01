import type { ChaiPlugin } from '@vitest/expect'
import type {
  Plugin as PrettyFormatPlugin,
} from '@vitest/pretty-format'
import type { SerializedConfig } from '../../runtime/config'
import { addSerializer, stripSnapshotIndentation } from '@vitest/snapshot'
import { parseStacktrace } from '@vitest/utils/source-map'
import * as chai from 'chai'
import { getSnapshotClient, getTestNames } from '../snapshot/chai'

// lazy load '@ark/attest` only when enabled
// TODO: can we read file .attest on our own? this is used only for `getTypeAssertionsAtPosition`.
// TODO: importing '@ark/attest' pulls entire 'typescript', so that should be avoided on runtime.
let lib: typeof import('@ark/attest')
let enabled = false

const attestChai: ChaiPlugin = (chai, utils) => {
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

  function setupOptions(ctx: object, name: string) {
    utils.flag(ctx, '_name', name)
    const isNot = utils.flag(ctx, 'negate')
    if (isNot) {
      throw new Error(`"${name}" cannot be used with "not"`)
    }
    const test = utils.flag(ctx, 'vitest-test')
    const options = getTestNames(test)
    return {
      skip: !enabled,
      error: utils.flag(ctx, 'error'),
      errorMessage: utils.flag(ctx, 'message'),
      ...options,
    }
  }

  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeSnapshot',
    function (
      this: Record<string, unknown>,
      message?: string,
    ) {
      const options = setupOptions(this, 'toMatchTypeSnapshot')
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].args[0].type
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        ...options,
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
      const assertOptions = setupOptions(this, 'toMatchTypeInlineSnapshot')
      if (inlineSnapshot) {
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
      }
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].args[0].type
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        isInline: true,
        inlineSnapshot,
        ...assertOptions,
      })
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeErrorSnapshot',
    function (
      this: Record<string, unknown>,
      message?: string,
    ) {
      const options = setupOptions(this, 'toMatchTypeErrorSnapshot')
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].errors[0]
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        ...options,
      })
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeErrorInlineSnapshot',
    function __INLINE_SNAPSHOT__(
      this: Record<string, unknown>,
      inlineSnapshot?: string,
      message?: string,
    ) {
      const assertOptions = setupOptions(this, 'toMatchTypeErrorInlineSnapshot')
      if (inlineSnapshot) {
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
      }
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].errors[0]
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        isInline: true,
        inlineSnapshot,
        ...assertOptions,
      })
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeCompletionSnapshot',
    function (
      this: Record<string, unknown>,
      message?: string,
    ) {
      const options = setupOptions(this, 'toMatchTypeCompletionSnapshot')
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].completions
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        ...options,
      })
    },
  )
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeCompletionInlineSnapshot',
    function __INLINE_SNAPSHOT__(
      this: Record<string, unknown>,
      inlineSnapshot?: string,
      message?: string,
    ) {
      const assertOptions = setupOptions(this, 'toMatchTypeCompletionInlineSnapshot')
      if (inlineSnapshot) {
        inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
      }
      let value: any
      if (enabled) {
        const types = getTypeAssertions(this)
        value = types[0][1].completions
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        message,
        isInline: true,
        inlineSnapshot,
        ...assertOptions,
      })
    },
  )
}

class AttestSnapshotWrapper {
  constructor(public value?: unknown) {}
}

const attestPrettyFormat: PrettyFormatPlugin = {
  test(val: unknown) {
    return !!(val && val instanceof AttestSnapshotWrapper)
  },
  serialize(val: AttestSnapshotWrapper, config, indentation, depth, refs, printer) {
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

export async function attestSetup(config: SerializedConfig) {
  chai.use(attestChai)
  addSerializer(attestPrettyFormat)
  enabled = config.attest
  if (enabled) {
    lib = await import('@ark/attest')
  }
  else {
    if (typeof process !== 'undefined') {
      process.env.ATTEST_skipTypes = 'true'
    }
  }
}
