import { test } from 'vitest'
import { page } from 'vitest/browser'

test('aria', async () => {
  document.body.innerHTML = `
<h1>Sign in</h1>
<label>Email <input type="email" value="john@example.com"></label>
<button>Submit</button>
<div hidden>Hidden text</div>
`
  await page.getByRole('button').click()

  document.body.innerHTML = '<p>Done</p>'
  await page.mark('done')
})
