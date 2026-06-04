import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('not found', async () => {
  document.body.innerHTML = `
    <main>
      <h1>Settings</h1>
      <button>Cancel</button>
    </main>
  `
  // TODO: surfacing element eror via expect.element is racy since
  // new timeout behavior https://github.com/vitest-dev/vitest/pull/10233
  // await expect.element(page.getByRole('button', { name: 'Save' }), { timeout: 200  }).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).findElement({ timeout: 200  })
})
