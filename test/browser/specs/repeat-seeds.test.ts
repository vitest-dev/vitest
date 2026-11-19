import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

declare module 'vitest' {
  interface TaskMeta {
    seeds?: string[]
  }
}

test('each repeat in the browser gets its own seed, and a failed repeat runs again with it', async () => {
  const { stderr, results } = await runInlineBrowserTests(
    {
      'dice.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('rolls a six', { repeats: 2 }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
        expect(random.int(1, 6)).toBe(6)
      })
    `,
    },
    // the search for a smaller input runs the test again, see shrink.test.ts
    { seed: 0, shrink: false },
  )
  expect(results).toHaveLength(instances.length)
  const replayLines = stderr.split('\n').filter((line) => /^ +Replay {2}/.test(line))
  // on Windows, the replay command quotes arguments for PowerShell
  const pattern = process.platform === 'win32' ? '"^rolls a six`$"' : `'^rolls a six$'`
  for (const module of results) {
    const project = module.project.name
    const [testCase] = module.children.allTests()
    const attempts = testCase.attempts()
    // the seeds that the test saw are the seeds of its attempts
    expect(attempts.map((attempt) => attempt.seed)).toEqual(testCase.meta().seeds)
    const failed = attempts.filter((attempt) => attempt.state === 'failed')
    const firstRuns = failed.filter((attempt) => attempt.retryIndex === 0)
    const replays = failed.filter((attempt) => attempt.retryIndex === 1)
    expect(firstRuns.length).toBeGreaterThan(0)
    expect(replays.map(({ repeatIndex, seed }) => ({ repeatIndex, seed }))).toEqual(
      firstRuns.map(({ repeatIndex, seed }) => ({ repeatIndex, seed })),
    )
    const replayLine = replayLines.find((line) => line.includes(`--project ${project} `))
    expect(replayLine).toBe(
      `     Replay  vitest run dice.test.js -t ${pattern} --project ${project} --seed 0 --replay-seed ${firstRuns[0].seed}`,
    )
  }
})

test('a replay in the browser that does not fail again shows the first random call that is different', async () => {
  const { results } = await runInlineBrowserTests(
    {
      'balancer.test.js': /* js */ `
      import { expect, test, vi } from 'vitest'

      const regions = ['us', 'eu']
      // the balancer keeps its position from one run to the next
      let next = 0

      function route(random) {
        const region = regions[next++ % regions.length]
        if (region === 'us') {
          return { region, delay: random.int(0, 100) }
        }
        // the eu client creates its request id with Math.random
        return { region, id: Math.random().toString(36).slice(2) }
      }

      test('routes the request to the eu region', ({ random }) => {
        vi.useFakeRandom()
        expect(route(random).region).toBe('eu')
      })
    `,
    },
    { seed: 0 },
  )
  expect(results).toHaveLength(instances.length)
  for (const module of results) {
    const [testCase] = module.children.allTests()
    expect(testCase.attempts().map(({ state }) => state)).toEqual(['failed', 'passed'])
    const divergence = testCase.task.result?.attempts?.[1].divergence
    // the failed run read `random`, and the replay read `Math.random`
    expect(divergence?.sources).toEqual([[], ['vitest:globals']])
    // each browser has other seeds, and its own columns
    expect(
      divergence?.nextRun?.calls?.map(({ text, location }) => [
        text.replace(/ → .*/, ''),
        location && `${location.file.split('/').at(-1)}:${location.line}`,
      ]),
    ).toEqual([
      ['Math.random()', 'balancer.test.js:14'],
      ['random.int(0, 100)', 'balancer.test.js:11'],
    ])
  }
})

test('a label in the browser that is false with every seed fails the test at its first call', async () => {
  const { results } = await runInlineBrowserTests(
    {
      'network.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('delivers the messages', { repeats: 2 }, ({ random }) => {
        const network = random.fork('network')
        expect.sometimes(network.bool(0.9), 'a delivered message')
        expect.sometimes(false, 'a lost message')
      })
    `,
    },
    { seed: 0 },
  )
  expect(results).toHaveLength(instances.length)
  for (const module of results) {
    const [testCase] = module.children.allTests()
    expect(
      testCase
        .result()
        .errors?.map(({ name, message, stacks }) => [
          `${name}: ${message}`,
          stacks?.[0] && `${stacks[0].file.split('/').at(-1)}:${stacks[0].line}`,
        ]),
    ).toEqual([
      [
        'NeverReachedError: expect.sometimes() was never true for "a lost message" in 3 runs',
        'network.test.js:7',
      ],
    ])
  }
})
