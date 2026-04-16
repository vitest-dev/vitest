import { test } from 'vitest'
import { page } from 'vitest/browser'

// TODO
test('inline styles', async () => {
  document.body.innerHTML = '<button style="color: red">Hello</button>'
  await page.mark('button rendered with css')
})
