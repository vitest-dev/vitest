import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('basic', async () => {
  document.body.innerHTML = '<button>hello</button>'
  await expect
    .element(page.getByRole('button'))
    .toHaveTextContent('hello')
  await expect
    .element(page.getByRole('button'))
    .toHaveAccessibleName('hello')
  await expect
    .element(page.getByRole('button'), { timeout: 100 })
    .toHaveTextContent('world')
})
