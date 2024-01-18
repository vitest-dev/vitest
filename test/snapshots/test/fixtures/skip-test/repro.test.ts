import { describe, expect, it } from 'vitest'

const ENABLE_SKIP = process.env.ENABLE_SKIP;

describe.skipIf(ENABLE_SKIP)('repro suite', () => {
  it('inner case', () => {
    expect('hi-1').toMatchSnapshot()
  })
})

it.skipIf(ENABLE_SKIP)('top-level case', () => {
  expect('hi-2').toMatchSnapshot()
})

// at least one non-skipped test is needed to reproduce a bug.
// without this, there will be no SnapshotClient.startCurrentRun,
// so the code to check skip/obsolete snapshot is not exercised.
it('normal case', () => {
  expect(0).toBe(0)
})
