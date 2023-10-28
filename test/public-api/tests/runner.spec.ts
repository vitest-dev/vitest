import { expect, it } from 'vitest'
import type { File, TaskResultPack, UserConfig } from 'vitest'
import { resolve } from 'pathe'
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
] as UserConfig[])('passes down metadata when $name', async (config) => {
  const taskUpdate: TaskResultPack[] = []
  const finishedFiles: File[] = []
  const { vitest, stdout, stderr } = await runVitest({
    root: resolve(__dirname, '..', 'fixtures'),
    include: ['**/*.spec.ts'],
    reporters: [
      'verbose',
      {
        onTaskUpdate(packs) {
          taskUpdate.push(...packs.filter(i => i[1]?.state === 'pass'))
        },
        onFinished(files) {
          finishedFiles.push(...files || [])
        },
      },
    ],
    ...config,
  })

  expect(stderr).toBe('')

  expect(stdout).toContain('custom.spec.ts > custom')

  const suiteMeta = { done: true }
  const testMeta = { custom: 'some-custom-hanlder' }

  expect(taskUpdate).toHaveLength(2)
  expect(finishedFiles).toHaveLength(1)

  const files = vitest?.state.getFiles() || []
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
}, {
  timeout: 60_000,
  retry: 3,
})
