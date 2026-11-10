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

function buildWorkspace(name = 'test') {
  return {
    name,
    config: {
      root: import.meta.dirname,
      sequence: { groupOrder: 0 },
    },
  } as any as TestProject
}

const workspace = buildWorkspace()

function workspaced(files: string[], project: TestProject = workspace) {
  return files.map((file) => new TestSpecification(project, file, 'forks'))
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
  function buildRandomSequencer(seed: number) {
    const ctx = buildCtx()
    ctx.config.seed = seed
    return new RandomSequencer(ctx)
  }

  function names(specs: TestSpecification[]) {
    return specs.map((spec) => `${spec.project.name}/${spec.moduleId}`)
  }

  test('sorting is the same when seed is defined', async () => {
    const sequencer = buildRandomSequencer(101)
    const sorted = await sequencer.sort(workspaced(['b', 'a', 'c']))
    expect(names(sorted)).toMatchInlineSnapshot(`
      [
        "test/a",
        "test/b",
        "test/c",
      ]
    `)
  })

  test('the order does not depend on the order of the input', async () => {
    const sequencer = buildRandomSequencer(101)
    const web = buildWorkspace('web')
    const node = buildWorkspace('node')
    const first = await sequencer.sort([
      ...workspaced(['a', 'b', 'c'], web),
      ...workspaced(['a', 'b', 'c'], node),
    ])
    const second = await sequencer.sort([
      ...workspaced(['c', 'a'], node),
      ...workspaced(['b', 'c', 'a'], web),
      ...workspaced(['b'], node),
    ])
    expect(names(second)).toEqual(names(first))
  })

  test('does not change the input', async () => {
    const sequencer = buildRandomSequencer(101)
    const files = workspaced(['b', 'a', 'c'])
    await sequencer.sort(files)
    expect(names(files)).toEqual(['test/b', 'test/a', 'test/c'])
  })
})
