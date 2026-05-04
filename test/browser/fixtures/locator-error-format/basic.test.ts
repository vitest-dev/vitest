import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('not found', async () => {
  document.body.innerHTML = `
    <main>
      <h1>Settings</h1>
      <button>Cancel</button>
    </main>
  `
  await expect.element(page.getByRole('button', { name: 'Save' }), { timeout: 100  }).toBeVisible()
})
