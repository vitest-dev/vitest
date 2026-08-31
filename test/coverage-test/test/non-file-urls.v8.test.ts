import { expect } from 'vitest'
import { runVitest, test } from '../utils'

test('non-file: URLs in v8 coverage are skipped', async () => {
  const { stdout, exitCode } = await runVitest({
    include: ['fixtures/test/non-file-urls-fixture.test.ts'],
    coverage: { reporter: 'json' },
    config: 'fixtures/configs/vitest.config.non-file-urls.ts',
  })

  expect(exitCode).toBe(0)
  expect(stdout).toContain('non-file-urls-fixture.test.ts')
})
