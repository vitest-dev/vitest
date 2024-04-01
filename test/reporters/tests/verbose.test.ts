import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('duration', async () => {
  const result = await runVitest({
    root: 'fixtures/duration',
    reporters: 'verbose',
    env: { CI: '1' },
  })

  const output = result.stdout.replaceAll(/\d+ms/g, '[...]ms')
  expect(output).toContain(`
 ✓ basic.test.ts > fast
 ✓ basic.test.ts > slow [...]ms
`)
})
