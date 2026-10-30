import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('pass', async () => {
  document.body.innerHTML = '<button>hello</button>'
  await expect.element(page.getByRole('button')).toHaveTextContent('hello')
})
