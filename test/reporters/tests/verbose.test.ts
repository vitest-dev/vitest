import { expect, test } from 'vitest'
import { runVitestCli } from '../../test-utils'

test('duration', async () => {
  const result = await runVitestCli({ env: { CI: '1' } }, '--root=fixtures/duration', '--reporter=verbose')
  const output = result.stdout.replaceAll(/\d+ms/g, '[...]ms')
  expect(output).toContain(`
 ✓ basic.test.ts > fast
 ✓ basic.test.ts > slow [...]ms
`)
})
