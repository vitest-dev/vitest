import { ChainableAssertions } from '@ark/attest/internal/assert/chainableAssertions.js'
import { getConfig } from '@ark/attest/internal/config.js'
import { chainableNoOpProxy } from '@ark/attest/internal/utils.js'
import { expect, skipSnapshot } from 'vitest'

const attestConfig = getConfig()

// for `attest().type.toString` and `attest().type.errors`
expect.addSnapshotSerializer({
  test(val: unknown) {
    // TODO(attest) more better way to target attest object?
    return (
      !!val
      && (typeof val === 'object' || typeof val === 'function')
      && typeof (val as any).unwrap === 'function'
    )
  },
  serialize(val, config, indentation, depth, refs, printer) {
    if (attestConfig.skipTypes) {
      skipSnapshot()
    }
    const serialized = val.unwrap();
    if (typeof serialized === 'string') {
      return serialized;
    }
    return printer(
      serialized,
      config,
      indentation,
      depth,
      refs,
    )
  },
})

// make `attest(xxx)` to work like `attest().type.toString`
expect.addSnapshotSerializer({
  test(val: unknown) {
    return val instanceof ChainableAssertions
  },
  serialize(val, _config, _indentation, _depth, _refs, _printer) {
    if (attestConfig.skipTypes) {
      skipSnapshot()
    }
    return val.type.toString.serializedActual
  },
})

expect.addSnapshotSerializer({
  test(val: unknown) {
    return val === chainableNoOpProxy
  },
  serialize(_val, _config, _indentation, _depth, _refs, _printer) {
    skipSnapshot()
  },
})
