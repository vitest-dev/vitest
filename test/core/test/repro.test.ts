import { describe, expect, it } from 'vitest'

// need at least one snapshot test to trigger `SnapshotClient.startCurrentRun` on current file
it('normal case (pre)', () => {
  expect(0).toBe(0)
})

describe.skipIf(process.env.REPRO_SKIP)('repro-suite', () => {
  it('repro-case', () => {
    expect('hello').toMatchSnapshot()
  })
})

it('normal case (post)', () => {
  expect(0).toBe(0)
})
