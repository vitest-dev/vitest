import type { File } from '../../../packages/vitest/src/runtime/runner/types'
import { describe, expect, it } from 'vitest'
import {
  computeDurationBreakdown,
  formatDurationBreakdown,
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
      files: [
        makeFile({ environment: 600, import: 200, tests: 50, setup: 150 }),
      ],
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
      files: [
        makeFile({ setup: 200, setupFetch: 100, import: 500, importFetch: 300, tests: 100 }),
      ],
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
      files: [
        makeFile({ setup: 100, setupFetch: 150, import: 200, importFetch: 250, tests: 100 }),
      ],
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

    expect(breakdown.phases.map(phase => phase.name)).toEqual(['import'])
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

    expect(formatDurationBreakdown(breakdown)).toBe('environment 86%, import 14%, tests 1%')
  })
})
