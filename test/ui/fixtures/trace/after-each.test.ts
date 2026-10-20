import { afterEach, test } from 'vitest'
import { page } from 'vitest/browser'

afterEach(async () => {
  document.body.innerHTML = ''
  await page.mark('Cleanup')
})

test('after-each', async () => {
  document.body.innerHTML = '<button>After each</button>'
  await page.getByRole('button').mark('Render after-each')
})
