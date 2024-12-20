import type { RunnerTaskResultPack, RunnerTestFile } from 'vitest'
import type { UserConfig } from 'vitest/node'
import { resolve } from 'pathe'
import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it.each([
  { name: 'threads are enabled', pool: 'threads' },
  { name: 'threads are disabled', pool: 'forks' },
  {
    name: 'running in the browser',
    browser: {
      enabled: true,
      provider: 'playwright',
      name: 'chromium',
      headless: true,
    },
  },
] as UserConfig[])('passes down metadata when $name', { timeout: 60_000, retry: 1 }, async (config) => {
  const taskUpdate: RunnerTaskResultPack[] = []
  const finishedFiles: RunnerTestFile[] = []
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
        onFinished(files) {
          finishedFiles.push(...files || [])
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
  expect(finishedFiles).toHaveLength(1)

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

  expect(finishedFiles[0].meta).toEqual(suiteMeta)
  expect(finishedFiles[0].tasks[0].meta).toEqual(testMeta)

  expect(files[0].meta).toEqual(suiteMeta)
  expect(files[0].tasks[0].meta).toEqual(testMeta)

  expect(finishedFiles[0].tasks[0].location).toEqual({
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
      column: 18,
    })
  })
})
