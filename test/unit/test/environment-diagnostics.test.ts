import { describe, expect, it } from 'vitest'
import { getEnvironmentDiagnostics, isSavingWorthHinting } from '../../../packages/vitest/src/node/reporters/diagnostics'

const domProject = {
  name: 'dom',
  environment: 'jsdom',
  pool: 'forks',
  isolate: true,
  browser: false,
  poolProvided: false,
  isolateProvided: false,
  environmentTime: 20_000,
  environmentCount: 40,
  trackedTime: 30_000,
  // estimated saving: 20s/8 - 20s/40 = 2s
  parallelism: 8,
  executionTime: 10_000,
}

describe('getEnvironmentDiagnostics', () => {
  it('fires for an isolating DOM project dominated by environment setup', () => {
    expect(getEnvironmentDiagnostics([domProject])).toEqual([
      {
        name: 'dom',
        environment: 'jsdom',
        environmentTime: 20_000,
        environmentCount: 40,
        share: 20_000 / 30_000,
        suggestIsolate: true,
      },
    ])
  })

  it('fires for happy-dom the same way', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, environment: 'happy-dom' }])).toEqual([
      {
        name: 'dom',
        environment: 'happy-dom',
        environmentTime: 20_000,
        environmentCount: 40,
        share: 20_000 / 30_000,
        suggestIsolate: true,
      },
    ])
  })

  it('fires for the threads pool', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, pool: 'threads' }])).toHaveLength(1)
  })

  it('fires exactly at the minimum time and share thresholds', () => {
    // 2s of setups over 8s of tracked time is exactly the 2s / 25% minimum;
    // saving: 2s/4 - 2s/40 = 450ms, above the 200ms (5% of 4s) floor
    expect(getEnvironmentDiagnostics([{
      ...domProject,
      environmentTime: 2_000,
      trackedTime: 8_000,
      parallelism: 4,
      executionTime: 4_000,
    }])).toHaveLength(1)
  })

  it('fires for a serial run - all setups but one are avoidable', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, parallelism: 1 }])).toHaveLength(1)
  })

  it('reports every affected project with its own numbers', () => {
    const components = {
      ...domProject,
      name: 'components',
      environment: 'happy-dom',
      environmentTime: 9_000,
      environmentCount: 30,
      trackedTime: 12_000,
    }
    expect(getEnvironmentDiagnostics([domProject, components])).toEqual([
      {
        name: 'dom',
        environment: 'jsdom',
        environmentTime: 20_000,
        environmentCount: 40,
        share: 20_000 / 30_000,
        suggestIsolate: true,
      },
      {
        name: 'components',
        environment: 'happy-dom',
        environmentTime: 9_000,
        environmentCount: 30,
        share: 9_000 / 12_000,
        suggestIsolate: true,
      },
    ])
  })

  it('does not suggest disabling isolation the user explicitly enabled', () => {
    const diagnostics = getEnvironmentDiagnostics([{ ...domProject, isolateProvided: true }])
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0].suggestIsolate).toBe(false)
  })

  it('stays quiet when the user explicitly configured the pool', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, poolProvided: true }])).toEqual([])
  })

  it('stays quiet for vm pools - the environment is already per worker', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, pool: 'vmThreads', isolate: false }])).toEqual([])
  })

  it('stays quiet without isolation - the environment is already per worker', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, isolate: false }])).toEqual([])
  })

  it('stays quiet for the node environment', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, environment: 'node' }])).toEqual([])
  })

  it('stays quiet for browser projects', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, browser: true }])).toEqual([])
  })

  it('stays quiet when the setup cost is small in absolute terms', () => {
    expect(getEnvironmentDiagnostics([{
      ...domProject,
      environmentTime: 1_000,
      trackedTime: 1_200,
    }])).toEqual([])
  })

  it('stays quiet when the setup cost is small relative to the run', () => {
    expect(getEnvironmentDiagnostics([{
      ...domProject,
      environmentTime: 3_000,
      trackedTime: 60_000,
    }])).toEqual([])
  })

  it('stays quiet for a single file - there is nothing to amortize', () => {
    expect(getEnvironmentDiagnostics([{ ...domProject, environmentCount: 1 }])).toEqual([])
  })

  it('stays quiet when the saving is negligible relative to a long run', () => {
    // ~2s estimated saving is below 5% of a 5-minute run and below 10s absolute
    expect(getEnvironmentDiagnostics([{ ...domProject, executionTime: 300_000 }])).toEqual([])
  })

  it('fires on long runs when the absolute saving is large', () => {
    // 100s/8 - 100s/50 = 10.5s: only 2.6% of the run, but 10s+ is worth attention
    expect(getEnvironmentDiagnostics([{
      ...domProject,
      environmentTime: 100_000,
      environmentCount: 50,
      trackedTime: 150_000,
      executionTime: 400_000,
    }])).toHaveLength(1)
  })

  it('reports only the affected projects', () => {
    const diagnostics = getEnvironmentDiagnostics([
      domProject,
      { ...domProject, name: 'unit', environment: 'node' },
    ])
    expect(diagnostics.map(diagnostic => diagnostic.name)).toEqual(['dom'])
  })
})

describe('isSavingWorthHinting', () => {
  it('requires a quarter of a second in absolute terms', () => {
    expect(isSavingWorthHinting(200, 1_000)).toBe(false)
  })

  it('accepts savings above 5% of the run', () => {
    expect(isSavingWorthHinting(300, 1_000)).toBe(true)
    expect(isSavingWorthHinting(500, 10_000)).toBe(true)
  })

  it('rejects savings below the noise floor of a long run', () => {
    expect(isSavingWorthHinting(300, 60_000)).toBe(false)
  })

  it('accepts 10s+ savings regardless of percentage', () => {
    expect(isSavingWorthHinting(12_000, 400_000)).toBe(true)
  })
})
