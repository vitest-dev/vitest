import { expect, skipSnapshot } from 'vitest'

expect.addSnapshotSerializer({
  test(val: unknown) {
    return (
      !!val
      && typeof val === 'object'
      && 'constructor' in val
      && typeof val.constructor === 'function'
      && val.constructor.name === 'ChainableAssertions'
    )
  },
  serialize(val, _config, _indentation, _depth, _refs, _printer) {
    if (process.env.ATTEST_skipTypes) {
      skipSnapshot()
    }
    // TODO: shouldn't pick only `attest().type.toString.snap` usage
    // since it should support anything like `attest().type.errors.snap` etc...
    return val.type.toString.serializedActual
  },
})
