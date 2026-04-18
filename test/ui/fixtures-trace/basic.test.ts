import { test } from 'vitest'
import { page } from 'vitest/browser'

test('locator.mark', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  await page.getByRole('button').mark('button rendered - locator')
})
