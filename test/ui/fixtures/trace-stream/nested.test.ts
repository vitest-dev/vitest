import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { waitForGate } from './helper'

test('nested', async () => {
  document.body.innerHTML = `
<main>
  <button>Outer</button>
  <button>Inner</button>
  <button>Sibling</button>
</main>
`

  await page.mark('Outer group', async () => {
    await page.getByRole('button', { name: 'Outer' }).mark('Outer mark')
    await waitForGate('nested-inner')

    await page.mark('Inner group', async () => {
      await page.getByRole('button', { name: 'Inner' }).mark('Inner mark')
      await Promise.all([
        expect
          .element(page.getByRole('button', { name: 'Leaf' }), { timeout: 10000 })
          .toBeVisible(),
        (async () => {
          await waitForGate('nested-leaf')
          document.querySelector('main')!.insertAdjacentHTML('beforeend', '<button>Leaf</button>')
        })(),
      ])
    })

    await waitForGate('nested-sibling')
    await page.getByRole('button', { name: 'Sibling' }).mark('Sibling mark')
  })
})
