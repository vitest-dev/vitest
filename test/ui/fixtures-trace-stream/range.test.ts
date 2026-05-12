import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { waitForGate } from './helper'

test('expect', async () => {
  document.body.innerHTML = '<button>A</button>'
  await Promise.all([
    (async () => {
      await expect
        .element(page.getByRole('button', { name: 'B' }), { timeout: 10000 })
        .toBeVisible()
    })(),
    (async () => {
      await waitForGate('expect-b')
      document.body.innerHTML = '<button>B</button>'
    })(),
  ])
  await Promise.all([
    (async () => {
      await expect
        .element(page.getByRole('button').filter({ hasText: 'C' }), { timeout: 10000 })
        .toHaveAttribute('data-testid', 'c')
    })(),
    (async () => {
      await waitForGate('expect-c')
      document.body.innerHTML = '<button data-testid="c">C</button>'
    })(),
  ])
})
