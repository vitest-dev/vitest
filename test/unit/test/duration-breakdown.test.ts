import type { File } from '../../../packages/vitest/src/runtime/runner/types'
import { describe, expect, it } from 'vitest'
import {
  computeDurationBreakdown,
  formatDurationBreakdown,
} from '../../../packages/vitest/src/node/reporters/durationBreakdown'

function makeFile(overrides: {
  setup?: number
  import?: number
  tests?: number
  environment?: number
}): File {
  return {
    setupDuration: overrides.setup ?? 0,
    collectDuration: overrides.import ?? 0,
    environmentLoad: overrides.environment ?? 0,
    result: { state: 'pass', duration: overrides.tests ?? 0 },
  } as unknown as File
}

describe('computeDurationBreakdown', () => {
  it('computes shares relative to the sum of tracked phases', () => {
    const breakdown = computeDurationBreakdown({
      files: [
        makeFile({ environment: 600, import: 200, tests: 50 }),
      ],
      transformTime: 150,
      typecheckTime: 0,
    })

    expect(breakdown.total).toBe(1000)
    expect(breakdown.phases).toEqual([
      { name: 'environment', time: 600, percent: 60 },
      { name: 'import', time: 200, percent: 20 },
      { name: 'transform', time: 150, percent: 15 },
      { name: 'tests', time: 50, percent: 5 },
    ])
  })

  it('sums phases across all files and projects', () => {
    const breakdown = computeDurationBreakdown({
      files: [
        makeFile({ environment: 900, tests: 100 }),
        makeFile({ import: 500, tests: 300 }),
      ],
      transformTime: 200,
      typecheckTime: 0,
    })

    expect(breakdown.total).toBe(2000)
    expect(breakdown.phases[0]).toEqual({ name: 'environment', time: 900, percent: 45 })
  })

  it('drops phases below half a percent', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ import: 1000, setup: 1 })],
      transformTime: 0,
      typecheckTime: 0,
    })

    expect(breakdown.phases.map(phase => phase.name)).toEqual(['import'])
  })

  it('includes typecheck time', () => {
    const breakdown = computeDurationBreakdown({
      files: [makeFile({ tests: 100 })],
      transformTime: 0,
      typecheckTime: 300,
    })

    expect(breakdown.phases[0]).toEqual({ name: 'typecheck', time: 300, percent: 75 })
  })

  it('returns no phases when nothing was tracked', () => {
    const breakdown = computeDurationBreakdown({
      files: [],
      transformTime: 0,
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
      transformTime: 0,
      typecheckTime: 0,
    })

    expect(formatDurationBreakdown(breakdown)).toBe('environment 86%, import 14%, tests 1%')
  })
})
