import { type File, type TaskResultPack, expect, it } from 'vitest'
import { resolve } from 'pathe'
import { runVitest } from '../../test-utils'

it('passes down metadata', async () => {
  const taskUpdate: TaskResultPack[] = []
  const finishedFiles: File[] = []
  const { vitest } = await runVitest({
    root: resolve(__dirname, '..', 'fixtures'),
    include: ['**/*.spec.ts'],
    reporters: [
      'verbose',
      {
        onTaskUpdate(packs) {
          taskUpdate.push(...packs)
        },
        onFinished(files) {
          finishedFiles.push(...files || [])
        },
      },
    ],
  })

  const suiteMeta = { done: true }
  const testMeta = { custom: 'some-custom-hanlder' }

  expect(taskUpdate).toHaveLength(2)
  expect(finishedFiles).toHaveLength(1)

  const files = vitest?.state.getFiles() || []
  expect(files).toHaveLength(1)

  expect(taskUpdate[0][2]).toEqual(suiteMeta)
  expect(taskUpdate[1][2]).toEqual(testMeta)

  expect(finishedFiles[0].meta).toEqual(suiteMeta)
  expect(finishedFiles[0].tasks[0].meta).toEqual(testMeta)

  expect(files[0].meta).toEqual(suiteMeta)
  expect(files[0].tasks[0].meta).toEqual(testMeta)
})
