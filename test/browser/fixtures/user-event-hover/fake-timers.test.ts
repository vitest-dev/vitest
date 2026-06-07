import { expect, onTestFinished, test, vi } from 'vitest'
import { page } from 'vitest/browser'

test('click advances fake timers while waiting for an element', async () => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })

  document.body.innerHTML = ''

  setTimeout(() => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Click me'
    button.addEventListener('click', () => {
      button.textContent = 'Clicked'
    })
    document.body.appendChild(button)
  }, 1000)

  await page.getByRole('button').click()

  await expect.element(page.getByRole('button')).toHaveTextContent('Clicked')
})
