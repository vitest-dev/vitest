import { page, userEvent } from '@vitest/browser/context'
import { test } from 'vitest'

test('basic', async () => {
  document.body.innerHTML = `<button>hello</button>`
  await userEvent.click(page.getByRole('button'), { force: true })
})
