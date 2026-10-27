import type { File } from '../../../packages/vitest/src/runtime/runner/types'
import { describe, expect, it } from 'vitest'
import {
  computeDurationBreakdown,
  formatDurationBreakdown,
  formatDurationSummary,
} from '../../../packages/vitest/src/node/reporters/durationBreakdown'

function makeFile(overrides: {
  setup?: number
  setupFetch?: number
  import?: number
  importFetch?: number
  tests?: number
  environment?: number
  worker?: number
}): File {
  return {
    setupDuration: overrides.setup ?? 0,
    setupFetchDuration: overrides.setupFetch ?? 0,
    collectDuration: overrides.import ?? 0,
    collectFetchDuration: overrides.importFetch ?? 0,
    environmentLoad: overrides.environment ?? 0,
    prepareDuration: overrides.worker ?? 0,
    result: { state: 'pass', duration: overrides.tests ?? 0 },
  } as unknown as File
}

describe('computeDurationBreakdown', () => {
  it('computes shares relative to the sum of tracked phases', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ environment: 600, import: 200, tests: 50, setup: 150 })],
      typecheckTime: 0,
    })

    expect(breakdown.total).toBe(1000)
    expect(breakdown.phases).toEqual([
      { name: 'environment', time: 600, percent: 60 },
      { name: 'import', time: 200, percent: 20 },
      { name: 'setup', time: 150, percent: 15 },
      { name: 'tests', time: 50, percent: 5 },
    ])
  })

  it('reports the transform wait as its own phase, excluded from setup and import', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ setup: 200, setupFetch: 100, import: 500, importFetch: 300, tests: 100 })],
      typecheckTime: 0,
    })

    expect(breakdown.total).toBe(800)
    expect(breakdown.phases).toEqual([
      { name: 'transform', time: 400, percent: 50 },
      { name: 'import', time: 200, percent: 25 },
      { name: 'setup', time: 100, percent: 12.5 },
      { name: 'tests', time: 100, percent: 12.5 },
    ])
  })

  it('never reports negative setup and import times', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ setup: 100, setupFetch: 150, import: 200, importFetch: 250, tests: 100 })],
      typecheckTime: 0,
    })

    expect(breakdown.phases).toEqual([
      { name: 'transform', time: 400, percent: 80 },
      { name: 'tests', time: 100, percent: 20 },
    ])
  })

  it('sums phases across all files and projects', () => {
    const breakdown = computeDurationBreakdown({
      files: [
        makeFile({ environment: 900, tests: 100 }),
        makeFile({ import: 700, importFetch: 200, tests: 300 }),
      ],
      typecheckTime: 0,
    })

    expect(breakdown.total).toBe(2000)
    expect(breakdown.phases[0]).toEqual({ name: 'environment', time: 900, percent: 45 })
    expect(breakdown.phases).toContainEqual({ name: 'transform', time: 200, percent: 10 })
  })

  it('drops phases below half a percent', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ import: 1000, setup: 1 })],
      typecheckTime: 0,
    })

    expect(breakdown.phases.map((phase) => phase.name)).toEqual(['import'])
  })

  it('includes worker preparation time', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ worker: 250, tests: 750 })],
      typecheckTime: 0,
    })

    expect(breakdown.phases).toEqual([
      { name: 'tests', time: 750, percent: 75 },
      { name: 'worker', time: 250, percent: 25 },
    ])
  })

  it('includes typecheck time', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ tests: 100 })],
      typecheckTime: 300,
    })

    expect(breakdown.phases[0]).toEqual({ name: 'typecheck', time: 300, percent: 75 })
  })

  it('returns no phases when nothing was tracked', () => {
    const breakdown = computeDurationBreakdown({
      files: [],
      typecheckTime: 0,
    })
    expect(breakdown.total).toBe(0)
    expect(breakdown.phases).toEqual([])
  })
})

describe('formatDurationBreakdown', () => {
  it('formats phases as rounded percentages', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ environment: 856, import: 137, tests: 7 })],
      typecheckTime: 0,
    })

    expect(formatDurationBreakdown(breakdown)).toBe(
      'environment 856ms (86%), import 137ms (14%), tests 7ms (1%)',
    )
  })
})

describe('formatDurationSummary', () => {
  it('attributes setup, imports and tests to user code, excluding transform waits', () => {
    const breakdown = computeDurationBreakdown({
      files: [
        makeFile({
          setup: 200,
          setupFetch: 100,
          import: 300,
          importFetch: 100,
          tests: 200,
          environment: 100,
          worker: 100,
        }),
      ],
      typecheckTime: 100,
    })

    expect([breakdown.userCode, breakdown.vitest, breakdown.total]).toMatchInlineSnapshot(`
      [
        500,
        500,
        1000,
      ]
    `)
    expect(formatDurationSummary(breakdown)).toMatchInlineSnapshot(`"user code 50%, Vitest 50%"`)
  })

  it('includes phases hidden from the detailed breakdown', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ setup: 4, import: 4, tests: 4, environment: 988 })],
      typecheckTime: 0,
    })

    expect(formatDurationSummary(breakdown)).toMatchInlineSnapshot(`"user code 1%, Vitest 99%"`)
  })

  it.each([
    { tests: 505, worker: 495, expected: 'user code 51%, Vitest 49%' },
    { tests: 0, worker: 1000, expected: 'user code 0%, Vitest 100%' },
    { tests: 1000, worker: 0, expected: 'user code 100%, Vitest 0%' },
    { tests: 1, worker: 999, expected: 'user code <1%, Vitest >99%' },
    { tests: 999, worker: 1, expected: 'user code >99%, Vitest <1%' },
  ])('formats complementary shares: $expected', ({ tests, worker, expected }) => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ tests, worker })],
      typecheckTime: 0,
    })

    expect(formatDurationSummary(breakdown)).toBe(expected)
  })

  it('does not invent a split when no timings are available', () => {
    expect(formatDurationSummary(computeDurationBreakdown({ files: [], typecheckTime: 0 }))).toBe(
      '',
    )
  })

  it('supports reports without fetch timings', () => {
    const file = makeFile({ setup: 100, import: 200, tests: 500, worker: 200 })
    delete file.setupFetchDuration
    delete file.collectFetchDuration

    expect(
      formatDurationSummary(computeDurationBreakdown({ files: [file], typecheckTime: 0 })),
    ).toMatchInlineSnapshot(`"user code 80%, Vitest 20%"`)
  })
})
