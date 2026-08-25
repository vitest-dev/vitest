import { expect } from 'vitest'
import { test } from './trace/test'

test('custom trace', async ({ page, trace }) => {
  await trace.snapshot('before action')

  const result = await trace.mark('action', async () => {
    await page.getByRole('button', { name: 'Before action' }).click()
    return page.getByRole('button').textContent()
  }, { kind: 'action' })
  expect(result).toBe('After action')
})
