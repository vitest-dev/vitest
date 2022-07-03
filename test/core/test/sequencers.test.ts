import type { Vitest } from 'vitest'
import { describe, expect, test, vi } from 'vitest'
import { BaseSequencer } from '../../../packages/vitest/src/node/sequencers/BaseSequencer'

const buildCtx = () => {
  return {
    state: {
      getFileTestResults: vi.fn(),
      getFileStats: vi.fn(),
    },
  } as unknown as Vitest
}

describe('test sequelizers', () => {
  test('sorting when no info is available', async () => {
    const sequelizer = new BaseSequencer(buildCtx())
    const files = ['a', 'b', 'c']
    const sorted = await sequelizer.sort(files)
    expect(sorted).toStrictEqual(files)
  })

  test('prioritaze unknown files', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.state, 'getFileStats').mockImplementation((file) => {
      if (file === 'b')
        return { size: 2 }
    })
    const sequelizer = new BaseSequencer(ctx)
    const files = ['b', 'a', 'c']
    const sorted = await sequelizer.sort(files)
    expect(sorted).toStrictEqual(['a', 'c', 'b'])
  })

  test('sort by size, larger first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.state, 'getFileStats').mockImplementation((file) => {
      if (file === 'a')
        return { size: 1 }
      if (file === 'b')
        return { size: 2 }
      if (file === 'c')
        return { size: 3 }
    })
    const sequelizer = new BaseSequencer(ctx)
    const files = ['b', 'a', 'c']
    const sorted = await sequelizer.sort(files)
    expect(sorted).toStrictEqual(['c', 'b', 'a'])
  })

  test('sort by results, failed first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.state, 'getFileTestResults').mockImplementation((file) => {
      if (file === 'a')
        return { failed: false, duration: 1 }
      if (file === 'b')
        return { failed: true, duration: 1 }
      if (file === 'c')
        return { failed: true, duration: 1 }
    })
    const sequelizer = new BaseSequencer(ctx)
    const files = ['b', 'a', 'c']
    const sorted = await sequelizer.sort(files)
    expect(sorted).toStrictEqual(['b', 'c', 'a'])
  })

  test('sort by results, long first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.state, 'getFileTestResults').mockImplementation((file) => {
      if (file === 'a')
        return { failed: true, duration: 1 }
      if (file === 'b')
        return { failed: true, duration: 2 }
      if (file === 'c')
        return { failed: true, duration: 3 }
    })
    const sequelizer = new BaseSequencer(ctx)
    const files = ['b', 'a', 'c']
    const sorted = await sequelizer.sort(files)
    expect(sorted).toStrictEqual(['c', 'b', 'a'])
  })

  test('sort by results, long and failed first', async () => {
    const ctx = buildCtx()
    vi.spyOn(ctx.state, 'getFileTestResults').mockImplementation((file) => {
      if (file === 'a')
        return { failed: false, duration: 1 }
      if (file === 'b')
        return { failed: false, duration: 6 }
      if (file === 'c')
        return { failed: true, duration: 3 }
    })
    const sequelizer = new BaseSequencer(ctx)
    const files = ['b', 'a', 'c']
    const sorted = await sequelizer.sort(files)
    expect(sorted).toStrictEqual(['c', 'b', 'a'])
  })
})
