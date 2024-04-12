import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('should print logs correctly', async () => {
  const result = await runVitest({ root: './fixtures' }, ['error-to-json.test.ts'])
  expect(result.stderr).toContain(`Serialized Error: { date: '1970-01-01T00:00:00.000Z' }`)
})
