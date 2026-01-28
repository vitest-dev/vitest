import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

test('runs tests correctly when project name contains special characters', async () => {
  const { stderr, stdout, exitCode, ctx } = await runBrowserTests({
    root: './fixtures/project-name-encoding',
  })

  expect(stderr).toBe('')
  expect(exitCode).toBe(0)

  const projectName = ctx.config.name
  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('basic.test.ts', `${projectName} (${browser})`)
  })
})
