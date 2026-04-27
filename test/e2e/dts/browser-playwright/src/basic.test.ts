import { test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

test('basic', async () => {
  document.body.innerHTML = `<button>hello</button>`
  await userEvent.click(page.getByRole('button'), { force: true })
})
