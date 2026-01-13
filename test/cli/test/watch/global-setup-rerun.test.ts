import { editFile, runVitest } from '#test-utils'
import { expect, test } from 'vitest'

const testFile = 'fixtures/watch/math.test.ts'

test('global setup calls hooks correctly when file changes', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/watch',
    watch: true,
    include: ['math.test.ts'],
    globalSetup: ['./global-setup.ts'],
  })

  await vitest.waitForStdout('Waiting for file changes')

  const calls = (globalThis as any).__CALLS as string[]
  expect(calls).toEqual(['start'])

  editFile(testFile, testFileContent => `${testFileContent}\n\n`)

  await vitest.waitForStdout('RERUN')
  expect(calls).toEqual(['start', 'rerun'])

  await ctx?.close()

  expect(calls).toEqual(['start', 'rerun', 'end'])
})

test('global setup calls hooks correctly with a manual rerun', async () => {
  const { vitest, ctx } = await runVitest({
    root: 'fixtures/watch',
    watch: true,
    include: ['math.test.ts'],
    globalSetup: ['./global-setup.ts'],
  })

  await vitest.waitForStdout('Waiting for file changes')

  const calls = (globalThis as any).__CALLS as string[]
  expect(calls).toEqual(['start'])

  vitest.write('r')

  await vitest.waitForStdout('RERUN')
  expect(calls).toEqual(['start', 'rerun'])

  await ctx?.close()

  expect(calls).toEqual(['start', 'rerun', 'end'])
})
