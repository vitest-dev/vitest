import type { ChaiPlugin } from '@vitest/expect'
import type {
  Plugin as PrettyFormatPlugin,
} from '@vitest/pretty-format'
import { addSerializer, skipSnapshot } from '@vitest/snapshot'
import * as chai from 'chai'
import { getSnapshotClient, getTestNames } from '../snapshot/chai'
import { parseStacktrace } from '@vitest/utils/source-map'

// lazy load '@ark/attest` only when enabled
let lib: typeof import('@ark/attest')
let enabled = false

const plugin: ChaiPlugin = (chai, utils) => {
  utils.addMethod(
    chai.Assertion.prototype,
    'toMatchTypeSnapshot',
    function (
      this: Record<string, unknown>,
    ) {
      utils.flag(this, '_name', 'toMatchTypeSnapshot')
      const test = utils.flag(this, 'vitest-test')
      const errorMessage = utils.flag(this, 'message')
      let value: any
      if (enabled) {
        // TODO: can we specify ".attest/assertions" directory?
        // TODO: caller here cannot get call stack of `expect(value)`
        //       can attest support such analysis that
        //         expect(value).xxx(...)
        //       then `value` is analyzed and can query from `xxx()`'s caller position?
        // TODO: probably we can use own location probing
        const parsed = parseStacktrace(new Error().stack ?? "");
        const location = parsed[0];
        const types = lib.getTypeAssertionsAtPosition({
          file: location.file,
          method: location.method,
          line: location.line,
          char: 3,
        })
        value = types[0][1].args[0].type
      }
      getSnapshotClient().assert({
        received: new AttestSnapshotWrapper(value),
        isInline: false,
        errorMessage,
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
      skipSnapshot()
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
