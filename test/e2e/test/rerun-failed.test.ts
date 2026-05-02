import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('rerunFailed only re-runs the failed tests, not the whole files', async () => {
  const { ctx } = await runInlineTests({
    'a.test.ts': `
      import { test, expect } from 'vitest'
      test('passes', () => { expect(1).toBe(1) })
      test('fails', () => { expect(1).toBe(2) })
    `,
  }, { watch: true })

  const fileBefore = ctx!.state.getFiles()[0]
  const [passBefore, failBefore] = fileBefore.tasks
  expect(passBefore.result?.state).toBe('pass')
  expect(failBefore.result?.state).toBe('fail')

  await ctx!.rerunFailed()

  const fileAfter = ctx!.state.getFiles()[0]
  const [passAfter, failAfter] = fileAfter.tasks
  expect(passAfter.mode).toBe('skip')
  expect(failAfter.mode).toBe('run')
  expect(failAfter.result?.state).toBe('fail')

  await ctx!.close()
})

test('rerunFailed falls back to whole-file rerun when collection failed', async () => {
  const { ctx } = await runInlineTests({
    'broken.test.ts': `
      throw new Error('collection error')
    `,
  }, { watch: true })

  const fileBefore = ctx!.state.getFiles()[0]
  expect(fileBefore.result?.state).toBe('fail')

  await ctx!.rerunFailed()

  const fileAfter = ctx!.state.getFiles()[0]
  expect(fileAfter.result?.state).toBe('fail')

  await ctx!.close()
})
