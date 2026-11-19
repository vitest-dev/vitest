import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

const queueTests = {
  'queue.test.js': /* js */ `
    import { expect, test } from 'vitest'

    // a queue that drops the jobs above its size limit
    function enqueue(jobs) {
      return jobs.filter((size) => size <= 500)
    }

    test('the queue keeps every job', async ({ random, annotate }) => {
      const jobs = random.many('jobs', () => random.int(0, 1000))
      console.log('jobs', jobs.length)
      await annotate(jobs.length + ' jobs')
      expect(enqueue(jobs)).toEqual(jobs)
    })
  `,
}

test('shrinks the random values of a failed test in the browser', async () => {
  // the same seed fails in Node.js, see test/e2e/test/config/shrink.test.ts
  const replaySeed = '4b22ec81796e2c5c'
  const { results, stdout } = await runInlineBrowserTests(queueTests, {
    seed: 0,
    browser: { screenshotFailures: true },
    $cliOptions: { replaySeed, shrink: true },
  })
  expect(results).toHaveLength(instances.length)
  for (const module of results) {
    const [testCase] = module.children.allTests()
    expect(testCase.result().errors?.map((error) => error.message)).toEqual([
      'expected [] to deeply equal [ 501 ]',
    ])
    expect(testCase.attempts()[0].shrink).toMatchObject({
      shrunk: true,
      reproduced: true,
      tape: 'AQEAAwKr1arVAtHf-sAH',
    })
    // the runs of smaller inputs take no screenshots
    const screenshots = testCase
      .artifacts()
      .filter((artifact) => artifact.type === 'internal:failureScreenshot')
    expect(screenshots).toHaveLength(1)
    // only the failed attempt and the run of the smallest input report them
    expect(testCase.annotations().map((annotation) => annotation.message)).toEqual([
      '7 jobs',
      '1 jobs',
    ])
  }
  expect(
    stdout
      .split('\n')
      .filter((line) => line.startsWith('jobs'))
      .sort(),
  ).toEqual(instances.flatMap(() => ['jobs 1', 'jobs 7']).sort())
})

test('the values of the smallest input have the place of each call in the browser', async () => {
  const { results } = await runInlineBrowserTests(
    {
      'dice.test.js': /* js */ `
        import { expect, test } from 'vitest'

        test('rolls a seven', ({ random }) => {
          expect(random.int(1, 6)).toBe(7)
        })
      `,
    },
    { seed: 0 },
  )
  expect(results).toHaveLength(instances.length)
  for (const module of results) {
    const [testCase] = module.children.allTests()
    const calls = testCase.attempts().find((attempt) => attempt.shrink)?.shrink?.calls ?? []
    expect(
      calls.map(({ text, location }) => ({
        text,
        location: location && `${location.file.split('/').at(-1)}:${location.line}`,
      })),
    ).toEqual([{ text: 'random.int(1, 6) → 1', location: 'dice.test.js:5' }])
  }
})
