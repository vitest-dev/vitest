import { expect, it } from 'vitest'

import { runVitest } from '../../test-utils'

it('related correctly runs only related tests', async () => {
  const { stdout, stderr } = await runVitest({
    related: 'src/sourceA.ts',
    root: './fixtures/related',
    globals: true,
  })

  expect(stderr).toBe('')
  expect(stdout).toContain('3 passed')
  expect(stdout).toContain('related.test.ts')
  expect(stdout).toContain('deep-related-imports.test.ts')
  expect(stdout).toContain('deep-related-exports.test.ts')
  expect(stdout).not.toContain('not-related.test.ts')
})
