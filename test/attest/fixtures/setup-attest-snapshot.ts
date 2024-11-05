import { ChainableAssertions } from '@ark/attest/internal/assert/chainableAssertions.js'
import { getConfig } from '@ark/attest/internal/config.js'
import { chainableNoOpProxy } from '@ark/attest/internal/utils.js'
import { expect, skipSnapshot } from 'vitest'

const attestConfig = getConfig()

// for `attest().type.toString` and `attest().type.errors`
expect.addSnapshotSerializer({
  test(val: unknown) {
    // TODO(attest) better way to detect proxy?
    return (
      !!val
      && typeof val === 'function'
      && typeof (val as any).snap === 'function'
    )
  },
  serialize(val, _config, _indentation, _depth, _refs, _printer) {
    if (attestConfig.skipTypes) {
      skipSnapshot()
    }
    return val.serializedActual
  },
})

// for `attest()` to work like `attest().type.toString`
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
    return !!val && typeof val === 'object' && '$workaroundCompletions' in val && val.$workaroundCompletions instanceof ChainableAssertions
  },
  serialize(val, config, indentation, depth, refs, printer) {
    if (attestConfig.skipTypes) {
      skipSnapshot()
    }
    const instance = val.$workaroundCompletions
    // eslint-disable-next-line ts/no-unused-expressions
    instance.completions // getter side effect seems to do magic
    return printer(
      instance.serializedActual,
      config,
      indentation,
      depth,
      refs,
    )
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
