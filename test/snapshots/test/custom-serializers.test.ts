import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('it should pass', async () => {
  const { stdout, stderr } = await runVitest({
    root: 'test/fixtures/custom-serializers',
  })

  expect(stdout).toContain('✓ custom-serializers.test.ts')
  expect(stderr).toBe('')
})
