import type { Vitest, WorkspaceProject } from 'vitest/node'
import type { WorkspaceSpec as DeprecatedWorkspaceSpec } from '../../../packages/vitest/src/node/pool'
import { describe, expect, test, vi } from 'vitest'
import { BaseSequencer } from '../../../packages/vitest/src/node/sequencers/BaseSequencer'
import { RandomSequencer } from '../../../packages/vitest/src/node/sequencers/RandomSequencer'
import { TestSpecification } from '../../../packages/vitest/src/node/spec'

function buildCtx() {
  return {
    config: {
      sequence: {},
    },
    cache: {
      getFileTestResults: vi.fn(),
      getFileStats: vi.fn(),
    },
  } as unknown as Vitest
}

function buildWorkspace() {
  return {
    name: 'test',
    config: {
      root: import.meta.dirname,
    },
  } as any as WorkspaceProject
}

const workspace = buildWorkspace()

function workspaced(files: string[]) {
  return files.map(file => new TestSpecification(workspace, file, 'forks')) as DeprecatedWorkspaceSpec[]
}

describe('base sequencer', () => {
  test('sorting when no info is available', async () => {
    const sequencer = new BaseSequencer(buildCtx())
    const files = workspaced(['a', 'b', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(files)
  })

  test('prioritize unknown files', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.cache, 'getFileStats').mockImplementation((file) => {
      if (file === 'test:b') {
        return { size: 2 }
      }
    })
    const sequencer = new BaseSequencer(ctx)
    const files = workspaced(['b', 'a', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(workspaced(['a', 'c', 'b']))
  })

  test('sort by size, larger first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.cache, 'getFileStats').mockImplementation((file) => {
      if (file === 'test:a') {
        return { size: 1 }
      }
      if (file === 'test:b') {
        return { size: 2 }
      }
      if (file === 'test:c') {
        return { size: 3 }
      }
    })
    const sequencer = new BaseSequencer(ctx)
    const files = workspaced(['b', 'a', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(workspaced(['c', 'b', 'a']))
  })

  test('sort by results, failed first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.cache, 'getFileTestResults').mockImplementation((file) => {
      if (file === 'test:a') {
        return { failed: false, duration: 1 }
      }
      if (file === 'test:b') {
        return { failed: true, duration: 1 }
      }
      if (file === 'test:c') {
        return { failed: true, duration: 1 }
      }
    })
    const sequencer = new BaseSequencer(ctx)
    const files = workspaced(['b', 'a', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(workspaced(['b', 'c', 'a']))
  })

  test('sort by results, long first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.cache, 'getFileTestResults').mockImplementation((file) => {
      if (file === 'test:a') {
        return { failed: true, duration: 1 }
      }
      if (file === 'test:b') {
        return { failed: true, duration: 2 }
      }
      if (file === 'test:c') {
        return { failed: true, duration: 3 }
      }
    })
    const sequencer = new BaseSequencer(ctx)
    const files = workspaced(['b', 'a', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(workspaced(['c', 'b', 'a']))
  })

  test('sort by results, long and failed first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.cache, 'getFileTestResults').mockImplementation((file) => {
      if (file === 'test:a') {
        return { failed: false, duration: 1 }
      }
      if (file === 'test:b') {
        return { failed: false, duration: 6 }
      }
      if (file === 'test:c') {
        return { failed: true, duration: 3 }
      }
    })
    const sequencer = new BaseSequencer(ctx)
    const files = workspaced(['b', 'a', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(workspaced(['c', 'b', 'a']))
  })
})

describe('random sequencer', () => {
  test('sorting is the same when seed is defined', async () => {
    const ctx = buildCtx()
    ctx.config.sequence.seed = 101
    const sequencer = new RandomSequencer(ctx)
    const files = workspaced(['b', 'a', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(workspaced(['a', 'c', 'b']))
  })
})
