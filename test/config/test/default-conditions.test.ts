import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('"module" condition for external dep', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/conditions-module',
  })

  expect(stderr).toBe('')
})

test('"module" condition for inline dep', async () => {
  const { stderr } = await runVitest({
    root: 'fixtures/conditions-module',
    server: {
      deps: {
        inline: ['@vitest/test-dep-conditions'],
      },
    },
  })

  expect(stderr).toBe('')
})
