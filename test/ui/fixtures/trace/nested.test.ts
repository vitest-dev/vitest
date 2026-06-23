import { test } from 'vitest'
import { page } from 'vitest/browser'

test('nested', async () => {
  document.body.innerHTML = `
<main>
  <button>Outer</button>
  <button>Inner</button>
  <button>Leaf</button>
  <button>Sibling</button>
</main>
`

  await page.mark('Outer group', async () => {
    await page.getByRole('button', { name: 'Outer' }).mark('Outer mark')
    await page.mark('Inner group', async () => {
      await page.getByRole('button', { name: 'Inner' }).mark('Inner mark')
      await page.getByRole('button', { name: 'Leaf' }).click()
    })
    await page.getByRole('button', { name: 'Sibling' }).mark('Sibling mark')
  })
})
