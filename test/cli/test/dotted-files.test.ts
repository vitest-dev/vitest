import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('run tests even though they are inside the .cache directory', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/dotted-files/.cache/projects/test',
  })
  expect(stderr).toBe('')
})
