import { expect, test } from 'vitest'
import { runInlineTests } from '#test-utils'

const fixture = {
  'math.ts': /* ts */ `
export function sum(a: number, b: number) {
  return a + b
}
`,
  'math.test.ts': /* ts */ `
import { expect, test } from 'vitest'

import { sum } from './math'

test('sum', () => {
  expect(sum(1, 2)).toBe(3)
})
`,
  'globalSetup.ts': /* ts */ `
import { TestProject } from 'vitest/node';

const calls: string[] = [];

(globalThis as any).__CALLS = calls

export default (project: TestProject) => {
  calls.push('start')
  project.onTestsRerun(() => {
    calls.push('rerun')
  })
  return () => {
    calls.push('end')
  }
}
`,
}

test('global setup calls hooks correctly when file changes', async () => {
  const { vitest, ctx, fs } = await runInlineTests(fixture, {
    watch: true,
    include: ['math.test.ts'],
    globalSetup: ['./globalSetup.ts'],
  })

  await vitest.waitForStdout('Waiting for file changes')

  const calls = (globalThis as any).__CALLS as string[]
  expect(calls).toEqual(['start'])

  fs.editFile('math.test.ts', testFileContent => `${testFileContent}\n\n`)

  await vitest.waitForStdout('RERUN')
  expect(calls).toEqual(['start', 'rerun'])

  await ctx?.close()

  expect(calls).toEqual(['start', 'rerun', 'end'])
})

test('global setup calls hooks correctly with a manual rerun', async () => {
  const { vitest, ctx } = await runInlineTests(fixture, {
    watch: true,
    include: ['math.test.ts'],
    globalSetup: ['./globalSetup.ts'],
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
