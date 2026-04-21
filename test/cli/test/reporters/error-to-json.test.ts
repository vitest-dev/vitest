import { runVitest } from '#test-utils'
import { expect, test } from 'vitest'

test('should print logs correctly', async () => {
  const result = await runVitest({ root: './fixtures/reporters' }, ['error-to-json.test.ts'])
  expect(result.stderr).toContain(`Serialized Error: { date: '1970-01-01T00:00:00.000Z' }`)
})
