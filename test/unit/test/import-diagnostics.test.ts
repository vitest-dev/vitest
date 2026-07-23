import { describe, expect, it } from 'vitest'
import { estimateModuleEvaluationSaving, getImportDiagnostics, getTransformDiagnostics } from '../../../packages/vitest/src/node/reporters/diagnostics'

// the barrel-file shape: 20 test files that each re-evaluate the same
// 800-module graph to use a few symbols from it
const barrelProject = {
  name: 'barrel',
  pool: 'forks',
  isolate: true,
  browser: false,
  isolateProvided: false,
  importTime: 15_000,
  trackedTime: 20_000,
  fetchCounts: Array.from({ length: 800 }, () => 20),
  fileCount: 20,
  // duplication: (20 - 8) / 20 = 0.6, estimated saving: 15s * 0.6 / 8 = 1.125s
  parallelism: 8,
  executionTime: 4_000,
}

describe('getImportDiagnostics', () => {
  it('fires when test files repeatedly evaluate a shared module graph', () => {
    expect(getImportDiagnostics([barrelProject])).toEqual([
      {
        name: 'barrel',
        importTime: 15_000,
        share: 15_000 / 20_000,
        totalFetches: 16_000,
        uniqueModules: 800,
        duplication: 0.6,
        estimatedSaving: (15_000 * 0.6) / 8,
      },
    ])
  })

  it('fires for the threads pool', () => {
    expect(getImportDiagnostics([{ ...barrelProject, pool: 'threads' }])).toHaveLength(1)
  })

  it('counts only the fetches above the worker parallelism as avoidable', () => {
    // 100 modules fetched 20 times (12 avoidable each on 8 lanes) and 100
    // fetched twice (0 avoidable): duplication = 1200 / 2200
    const fetchCounts = [
      ...Array.from({ length: 100 }, () => 20),
      ...Array.from({ length: 100 }, () => 2),
    ]
    expect(getImportDiagnostics([{ ...barrelProject, fetchCounts }])).toEqual([
      {
        name: 'barrel',
        importTime: 15_000,
        share: 15_000 / 20_000,
        totalFetches: 2_200,
        uniqueModules: 200,
        duplication: 1_200 / 2_200,
        estimatedSaving: (15_000 * (1_200 / 2_200)) / 8,
      },
    ])
  })

  it('fires exactly at the minimum duplication', () => {
    // 10 fetches per module on 8 lanes: duplication (10 - 8) / 10 = 0.2
    expect(getImportDiagnostics([{
      ...barrelProject,
      fetchCounts: Array.from({ length: 800 }, () => 10),
    }])).toHaveLength(1)
  })

  it('fires exactly at the minimum import time and share', () => {
    // 2s of imports over 8s of tracked time is exactly the 2s / 25% minimum;
    // saving on 4 lanes: 2s * 0.8 / 4 = 400ms, above the 250ms floor
    expect(getImportDiagnostics([{
      ...barrelProject,
      importTime: 2_000,
      trackedTime: 8_000,
      parallelism: 4,
    }])).toHaveLength(1)
  })

  it('treats every repeated fetch as avoidable on a single lane', () => {
    const diagnostics = getImportDiagnostics([{ ...barrelProject, parallelism: 1 }])
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].duplication).toBe(19 / 20)
    expect(diagnostics[0].estimatedSaving).toBe(15_000 * (19 / 20))
  })

  it('reports every affected project', () => {
    const diagnostics = getImportDiagnostics([barrelProject, { ...barrelProject, name: 'ui' }])
    expect(diagnostics.map(diagnostic => diagnostic.name)).toEqual(['barrel', 'ui'])
  })

  it('stays quiet for disjoint per-file graphs - reused workers would not help', () => {
    // every module belongs to one or two test files: no fetch count exceeds
    // the parallelism, so nothing is re-evaluated beyond what lanes require
    expect(getImportDiagnostics([{
      ...barrelProject,
      fetchCounts: Array.from({ length: 800 }, (_, i) => (i % 2 === 0 ? 1 : 2)),
    }])).toEqual([])
  })

  it('stays quiet when the tests dominate the run', () => {
    expect(getImportDiagnostics([{
      ...barrelProject,
      importTime: 2_500,
      trackedTime: 30_000,
    }])).toEqual([])
  })

  it('stays quiet when the import time is small in absolute terms', () => {
    expect(getImportDiagnostics([{
      ...barrelProject,
      importTime: 1_500,
      trackedTime: 2_000,
    }])).toEqual([])
  })

  it('does not suggest disabling isolation the user explicitly enabled', () => {
    expect(getImportDiagnostics([{ ...barrelProject, isolateProvided: true }])).toEqual([])
  })

  it('stays quiet without isolation - the graph is already shared', () => {
    expect(getImportDiagnostics([{ ...barrelProject, isolate: false }])).toEqual([])
  })

  it('stays quiet for vm pools - they re-create the graph per context regardless', () => {
    expect(getImportDiagnostics([{ ...barrelProject, pool: 'vmThreads' }])).toEqual([])
  })

  it('stays quiet for browser projects', () => {
    expect(getImportDiagnostics([{ ...barrelProject, browser: true }])).toEqual([])
  })

  it('stays quiet when files do not outnumber the workers', () => {
    expect(getImportDiagnostics([{ ...barrelProject, fileCount: 8 }])).toEqual([])
  })

  it('stays quiet when the saving is negligible relative to a long run', () => {
    // ~1.1s estimated saving is below 5% of a 5-minute run and below 10s absolute
    expect(getImportDiagnostics([{ ...barrelProject, executionTime: 300_000 }])).toEqual([])
  })
})

const coldProject = {
  name: 'cold',
  transformTime: 8_000,
  trackedTime: 20_000,
  fsModuleCache: false,
  fsModuleCacheProvided: false,
  executionTime: 10_000,
}

describe('getTransformDiagnostics', () => {
  it('fires when transforms dominate and nothing persists them', () => {
    expect(getTransformDiagnostics([coldProject])).toEqual([
      {
        name: 'cold',
        transformTime: 8_000,
        share: 8_000 / 20_000,
      },
    ])
  })

  it('stays quiet when the fs module cache is already enabled', () => {
    expect(getTransformDiagnostics([{ ...coldProject, fsModuleCache: true }])).toEqual([])
  })

  it('does not suggest a cache the user explicitly configured away', () => {
    expect(getTransformDiagnostics([{ ...coldProject, fsModuleCacheProvided: true }])).toEqual([])
  })

  it('stays quiet when the transform time is small in absolute terms', () => {
    expect(getTransformDiagnostics([{ ...coldProject, transformTime: 1_500 }])).toEqual([])
  })

  it('stays quiet when the tests dominate the run', () => {
    expect(getTransformDiagnostics([{
      ...coldProject,
      transformTime: 3_000,
      trackedTime: 30_000,
    }])).toEqual([])
  })

  it('stays quiet when the saving is negligible relative to a long run', () => {
    expect(getTransformDiagnostics([{
      ...coldProject,
      transformTime: 2_500,
      trackedTime: 9_000,
      executionTime: 300_000,
    }])).toEqual([])
  })
})

describe('estimateModuleEvaluationSaving', () => {
  it('spreads the avoidable evaluations across the worker lanes', () => {
    // a module evaluated by 20 files at 10ms each on 8 lanes keeps 8
    // evaluations: (200 * 12/20) / 8 = 15ms saved per module
    const modules = Array.from({ length: 10 }, () => Array.from({ length: 20 }, () => 10))
    expect(estimateModuleEvaluationSaving(modules, 8)).toBe(150)
  })

  it('saves nothing when no module is evaluated more often than the lanes', () => {
    const modules = [Array.from({ length: 8 }, () => 10), [10, 10]]
    expect(estimateModuleEvaluationSaving(modules, 8)).toBe(0)
  })

  it('treats every evaluation past the first as avoidable on a single lane', () => {
    expect(estimateModuleEvaluationSaving([[10, 10, 10, 10]], 1)).toBe(30)
  })
})
