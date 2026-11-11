import { expect, test } from 'vitest'
import { instances, runInlineBrowserTests } from './utils'

declare module 'vitest' {
  interface TaskMeta {
    seeds?: string[]
  }
}

test('each repeat in the browser gets its own seed, and a failed repeat runs again with it', async () => {
  const { stderr, results } = await runInlineBrowserTests({
    'dice.test.js': /* js */ `
      import { expect, test } from 'vitest'

      test('rolls a six', { repeats: 2 }, ({ task, random }) => {
        task.meta.seeds = [...(task.meta.seeds ?? []), random.seed]
        expect(random.int(1, 6)).toBe(6)
      })
    `,
  })
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
      `     Replay  vitest run dice.test.js -t ${pattern} --project ${project} --replay-seed ${firstRuns[0].seed}`,
    )
  }
})
