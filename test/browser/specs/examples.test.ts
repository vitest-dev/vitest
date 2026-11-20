import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

test('an example runs before the seeds in the browser, and a failed example runs again', async () => {
  const { results, stderr } = await runInlineBrowserTests(
    {
      'queue.test.js': /* js */ `
        import { expect, test } from 'vitest'

        // a queue that drops the jobs above its size limit
        function enqueue(jobs) {
          return jobs.filter((size) => size <= 500)
        }

        test('the queue keeps every job', { examples: [{ jobs: [501] }] }, ({ random }) => {
          const jobs = random.many('jobs', () => random.int(0, 500))
          expect(enqueue(jobs)).toEqual(jobs)
        })
      `,
    },
    { seed: 0 },
  )
  expect(results).toHaveLength(instances.length)
  for (const module of results) {
    const [testCase] = module.children.allTests()
    expect(
      testCase.attempts().map(({ state, example, seed }) => ({ state, example, seed: !!seed })),
    ).toEqual([
      { state: 'failed', example: 0, seed: false },
      { state: 'failed', example: 0, seed: false },
      { state: 'passed', example: undefined, seed: true },
    ])
  }
  expect(stderr.split('\n').filter((line) => /^ +Failed {2}/.test(line))).toEqual(
    instances.map(() => '     Failed  1 of 2 runs: 1st example'),
  )
})
