import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

test('vi.createRandom in the browser returns the values of project.createRandom', async () => {
  const { stderr, ctx, results } = await runInlineBrowserTests({
    'prices.test.js': /* js */ `
      import { test, vi } from 'vitest'

      test('records the price seed', ({ task }) => {
        task.meta.seed = vi.createRandom('prices').seed
      })
    `,
  })
  expect(stderr).toReportNoErrors()

  const seeds = results.map((module) => ({
    project: module.project.name,
    seed: [...module.children.allTests()][0].meta().seed,
  }))
  expect(seeds).toHaveLength(instances.length)
  for (const { project, seed } of seeds) {
    expect(seed).toBe(ctx!.getProjectByName(project).createRandom('prices').seed)
  }
})
