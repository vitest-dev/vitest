import type { DoctorCandidateOptions, DoctorProjectSummary } from '../../../packages/vitest/src/node/cli/doctor'
import { describe, expect, it } from 'vitest'
import { resolveDoctorCandidates } from '../../../packages/vitest/src/node/cli/doctor'

function project(overrides: Partial<DoctorProjectSummary>): DoctorProjectSummary {
  return {
    name: '',
    pool: 'forks',
    environment: 'node',
    isolate: true,
    browser: false,
    fsModuleCache: false,
    ...overrides,
  }
}

function candidateIds(projects: DoctorProjectSummary[], options?: DoctorCandidateOptions): string[] {
  return resolveDoctorCandidates(projects, options).map(candidate => candidate.id)
}

describe('resolveDoctorCandidates', () => {
  it('suggests threads, no-isolate and the fs cache for the default configuration', () => {
    expect(candidateIds([project({})])).toEqual(['threads', 'no-isolate', 'fs-cache'])
  })

  it('adds vmThreads for DOM environments', () => {
    expect(candidateIds([project({ environment: 'jsdom' })]))
      .toEqual(['threads', 'vmThreads', 'no-isolate', 'fs-cache'])
  })

  it('does not repeat what the config already uses', () => {
    expect(candidateIds([project({ pool: 'threads', isolate: false, fsModuleCache: true })])).toEqual([])
  })

  it('compares vm pools against reused workers with shared state', () => {
    expect(candidateIds([project({ pool: 'vmThreads', environment: 'jsdom', isolate: false, fsModuleCache: true })]))
      .toEqual(['threads-no-isolate'])
  })

  it('offers no-isolate to isolating browser projects', () => {
    expect(candidateIds([project({ browser: true, environment: 'jsdom' })])).toEqual(['no-isolate'])
  })

  it('has nothing to measure for browser projects without isolation', () => {
    expect(candidateIds([project({ browser: true, isolate: false })])).toEqual([])
  })

  it('considers every project of a workspace', () => {
    expect(candidateIds([
      project({ pool: 'threads', isolate: false }),
      project({ environment: 'happy-dom' }),
    ])).toEqual(['threads', 'vmThreads', 'no-isolate', 'fs-cache'])
  })

  it('offers happy-dom for a jsdom project when the package is available', () => {
    expect(candidateIds([project({ environment: 'jsdom' })], { happyDomAvailable: true }))
      .toEqual(['threads', 'vmThreads', 'happy-dom', 'no-isolate', 'fs-cache'])
  })

  it('does not offer happy-dom when the package cannot be resolved', () => {
    expect(candidateIds([project({ environment: 'jsdom' })], { happyDomAvailable: false }))
      .not
      .toContain('happy-dom')
  })

  it('offers the per-project swap to mixed-environment workspaces', () => {
    const candidates = resolveDoctorCandidates([
      project({ environment: 'jsdom' }),
      project({ environment: 'node' }),
    ], { happyDomAvailable: true })
    const happyDom = candidates.find(candidate => candidate.id === 'happy-dom')
    expect(happyDom?.envSwap).toEqual({ from: 'jsdom', to: 'happy-dom' })
  })

  it('does not offer happy-dom to suites already running it', () => {
    expect(candidateIds([project({ environment: 'happy-dom' })], { happyDomAvailable: true }))
      .not
      .toContain('happy-dom')
  })

  it('does not offer the fs cache when a project already enables it', () => {
    expect(candidateIds([
      project({ fsModuleCache: true }),
      project({}),
    ])).not.toContain('fs-cache')
  })

  it('primes the fs cache before measuring it', () => {
    const fsCache = resolveDoctorCandidates([project({})]).find(candidate => candidate.id === 'fs-cache')
    expect(fsCache?.primeRuns).toBe(1)
    expect(fsCache?.overrides).toEqual({ fsModuleCache: true })
  })

  it('does not offer the fs cache to browser-only workspaces', () => {
    expect(candidateIds([project({ browser: true })])).not.toContain('fs-cache')
  })
})
