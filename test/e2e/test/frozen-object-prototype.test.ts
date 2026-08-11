import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

const root = resolve(__dirname, '..', 'fixtures', 'frozen-object-prototype')

test('collects tests with includeTaskLocation when the test froze Object.prototype', async () => {
  const { stderr, ctx } = await runVitest({
    root,
    includeTaskLocation: true,
  })

  expect(stderr).not.toContain('Cannot assign to read only property')

  const files = ctx!.state.getFiles()
  expect(files).toHaveLength(1)
  expect(files[0].result?.state).toBe('pass')

  const tests = files[0].tasks.flatMap(suite => suite.type === 'suite' ? suite.tasks : [suite])
  expect(tests).toHaveLength(1)
  expect(tests[0].result?.state).toBe('pass')
})
