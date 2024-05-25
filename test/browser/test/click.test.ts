import { userEvent } from '@vitest/browser/context'
import { test, vi } from 'vitest'

test('clicks on an element', async () => {
  const button = document.createElement('button')
  button.textContent = 'Hello World'
  const fn = vi.fn()
  button.onclick = () => {
    fn()
  }
  document.body.appendChild(button)

  await userEvent.click(button, {
    timeout: 2000,
  })
  // expect(fn).toHaveBeenCalled()
})
