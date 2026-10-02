import type { TestProject, Vitest } from 'vitest/node'
import { describe, expect, test } from 'vitest'
import { BaseSequencer } from '../../../packages/vitest/src/node/sequencers/BaseSequencer'
import { RandomSequencer } from '../../../packages/vitest/src/node/sequencers/RandomSequencer'
import { TestSpecification } from '../../../packages/vitest/src/node/test-specification'

function buildCtx(config?: Partial<Vitest['config']>) {
  return {
    config: {
      sequence: { groupOrder: 0 },
      ...config,
    },
    cache: {
      getTestSpecificationResult: () => undefined,
    },
  } as unknown as Vitest
}

function buildWorkspace() {
  return {
    name: 'test',
    config: {
      root: import.meta.dirname,
      sequence: { groupOrder: 0 },
    },
  } as any as TestProject
}

const workspace = buildWorkspace()

function workspaced(files: string[]) {
  return files.map((file) => new TestSpecification(workspace, file, 'forks'))
}

describe('base sequencer', () => {
  test('sorting when no info is available', async () => {
    const sequencer = new BaseSequencer(buildCtx())
    const files = workspaced(['a', 'b', 'c'])
    const sorted = await sequencer.sort(files)
    expect(sorted).toStrictEqual(files)
  })

  test.each([
    { files: 4, count: 3, expected: [2, 1, 1] },
    { files: 5, count: 4, expected: [2, 1, 1, 1] },
    { files: 9, count: 4, expected: [3, 2, 2, 2] },
  ])('shard x/$count distributes $files files as $expected', async ({ count, files, expected }) => {
    const specs = Array.from(
      { length: files },
      (_, id) => ({ moduleId: `file-${id}.test.ts` }) as TestSpecification,
    )
    const slices = []

    for (const index of Array.from({ length: count }).keys()) {
      const ctx = buildCtx({ root: '/example/root', shard: { index: 1 + index, count } })
      const sequencer = new BaseSequencer(ctx)
      const shard = await sequencer.shard(specs)

      slices.push(shard.length)
    }

    expect(slices).toEqual(expected)

    const sum = slices.reduce((total, current) => total + current, 0)
    expect(sum).toBe(files)
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
