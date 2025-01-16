import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('correctly imports "module" dependency with default resolve.conditions', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/default-conditions',
  })

  expect(stderr).toBe('')
})
