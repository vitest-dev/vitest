import { afterEach, test } from 'vitest'
import { page } from 'vitest/browser'

afterEach(async () => {
  document.body.innerHTML = ''
  await page.mark('Cleanup')
  throw new Error('afterEach failure')
})

test('afterEach fail', async () => {
  document.body.innerHTML = '<button>After each</button>'
  await page.getByRole('button').mark('Render after-each')
})
