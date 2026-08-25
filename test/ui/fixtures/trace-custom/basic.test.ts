import { expect, test } from './trace/test'

test('custom trace', async ({ page }) => {
  await page.setContent('<main><button>Before action</button></main>')

  await page.locator('main').evaluate((element) => {
    element.innerHTML = '<button>After action</button>'
  })

  await expect(page.getByRole('button', { name: 'After action' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Missing' }).click({ timeout: 10 })).rejects.toThrow()
})
