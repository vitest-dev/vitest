import type { RunnerTaskResultPack, RunnerTestFile } from 'vitest'
import type { TestModule, TestUserConfig } from 'vitest/node'
import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { runVitest } from '../../test-utils'

it.each([
  { name: 'threads are enabled', pool: 'threads' },
  { name: 'threads are disabled', pool: 'forks' },
  {
    name: 'running in the browser',
    browser: {
      enabled: true,
    },
  },
] as TestUserConfig[])('passes down metadata when $name', { timeout: 60_000, retry: 1 }, async (config) => {
  const taskUpdate: RunnerTaskResultPack[] = []
  const finishedTestModules: TestModule[] = []
  const collectedFiles: RunnerTestFile[] = []
  const { ctx, stdout, stderr } = await runVitest({
    root: resolve(__dirname, '..', 'fixtures', 'public-api'),
    include: ['**/*.spec.ts'],
    reporters: [
      ['verbose', { isTTY: false }],
      {
        onTaskUpdate(packs) {
          taskUpdate.push(...packs.filter(i => i[1]?.state === 'pass'))
        },
        onTestRunEnd(testModules) {
          finishedTestModules.push(...testModules)
        },
        onCollected(files) {
          collectedFiles.push(...files || [])
        },
      },
    ],
    includeTaskLocation: true,
    ...config,
  })

  expect(stderr).toBe('')

  expect(stdout).toContain('custom.spec.ts > custom')

  const suiteMeta = { done: true }
  const testMeta = { custom: 'some-custom-hanlder' }

  expect(taskUpdate).toHaveLength(4)
  expect(finishedTestModules).toHaveLength(1)

  const files = ctx?.state.getFiles() || []
  expect(files).toHaveLength(1)

  expect(taskUpdate).toContainEqual(
    [
      expect.any(String),
      expect.anything(),
      suiteMeta,
    ],
  )

  expect(taskUpdate).toContainEqual(
    [
      expect.any(String),
      expect.anything(),
      testMeta,
    ],
  )

  const test = finishedTestModules[0].children.tests().next().value!

  expect(finishedTestModules[0].meta()).toEqual(suiteMeta)
  expect(test.meta()).toEqual(testMeta)

  expect(files[0].meta).toEqual(suiteMeta)
  expect(files[0].tasks[0].meta).toEqual(testMeta)

  expect(test.location).toEqual({
    line: 14,
    column: 1,
  })
  expect(collectedFiles[0].tasks[0].location).toEqual({
    line: 14,
    column: 1,
  })
  expect(files[0].tasks[0].location).toEqual({
    line: 14,
    column: 1,
  })

  const eachTests = [1, 2]
  eachTests.forEach((name, index) => {
    expect(files[0].tasks[index + 1].name).toBe(`custom ${name}`)
    expect(files[0].tasks[index + 1].location).toEqual({
      line: 18,
      // TODO: rolldown is more correct, but regular vite's source map is
      // a little bit wrong with the boundaries (maybe because of the SSR transform?)
      column: rolldownVersion || config.browser?.enabled ? 18 : 17,
    })
  })
})
