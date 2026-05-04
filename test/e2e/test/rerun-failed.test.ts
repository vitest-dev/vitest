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

test('rerunFailed respects active filenamePattern', async () => {
  const { ctx } = await runInlineTests({
    'a.test.ts': `
      import { test, expect } from 'vitest'
      test('a fails', () => { expect(1).toBe(2) })
    `,
    'b.test.ts': `
      import { test, expect } from 'vitest'
      test('b fails', () => { expect(1).toBe(2) })
    `,
  }, { watch: true })

  expect(ctx!.state.getFailedFilepaths()).toHaveLength(2)

  await ctx!.changeFilenamePattern('a.test.ts')

  const bStartBefore = ctx!.state.getFiles().find(f => f.name.includes('b.test.ts'))!.result?.startTime

  await ctx!.rerunFailed()

  const files = ctx!.state.getFiles()
  const aFile = files.find(f => f.name.includes('a.test.ts'))!
  const bFile = files.find(f => f.name.includes('b.test.ts'))!
  // a was rerun, b was not (filtered out by filenamePattern)
  expect(aFile.tasks[0].mode).toBe('run')
  expect(bFile.result?.startTime).toBe(bStartBefore)

  await ctx!.close()
})

test('rerunFailed scopes test ids per project in workspace mode', async () => {
  const { ctx } = await runInlineTests({
    'shared.test.ts': `
      import { test, expect } from 'vitest'
      test('passes in p2 only', () => {
        if (process.env.PROJ === 'p1') {
          expect(1).toBe(2)
        }
        else {
          expect(1).toBe(1)
        }
      })
    `,
    'vitest.config.ts': `
      export default {
        test: {
          projects: [
            { test: { name: 'p1', env: { PROJ: 'p1' } } },
            { test: { name: 'p2', env: { PROJ: 'p2' } } },
          ],
        },
      }
    `,
  }, { watch: true })

  const filesBefore = ctx!.state.getFiles()
  expect(filesBefore).toHaveLength(2)
  const p1Before = filesBefore.find(f => f.projectName === 'p1')!
  const p2Before = filesBefore.find(f => f.projectName === 'p2')!
  expect(p1Before.result?.state).toBe('fail')
  expect(p2Before.result?.state).toBe('pass')
  const p2StartBefore = p2Before.result?.startTime

  await ctx!.rerunFailed()

  const filesAfter = ctx!.state.getFiles()
  const p1After = filesAfter.find(f => f.projectName === 'p1')!
  const p2After = filesAfter.find(f => f.projectName === 'p2')!
  // p1 was rerun (its failing test stays 'run'); p2 was untouched.
  expect(p1After.tasks[0].mode).toBe('run')
  expect(p1After.result?.state).toBe('fail')
  expect(p2After.result?.startTime).toBe(p2StartBefore)

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
