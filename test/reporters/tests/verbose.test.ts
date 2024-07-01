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

test('prints error properties', async () => {
  const result = await runVitest({
    root: 'fixtures/error-props',
    reporters: 'verbose',
    env: { CI: '1' },
  })

  expect(result.stderr).toContain(`Serialized Error: { code: 404, status: 'not found' }`)
})
