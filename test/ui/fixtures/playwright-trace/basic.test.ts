import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('playwright trace', async () => {
  document.body.innerHTML = '<button>Click me</button>'
  const button = document.querySelector('button')!
  button.addEventListener('click', () => {
    button.textContent = 'Clicked'
  })
  await page.getByRole('button', { name: 'Click me' }).click()
  await expect.element(page.getByRole('button')).toHaveTextContent('Clicked')
})
