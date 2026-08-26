import { expect } from 'vitest'
import { test } from './trace/test'

test('custom trace', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Before action' }).click()

  await expect(page.getByRole('button', { name: 'After action' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Missing' }).click({ timeout: 10 })).rejects.toThrow()
})
