import { beforeEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.body.innerHTML = ''
})

test('click records a trace entry', async () => {
  document.body.innerHTML = '<button>Hello</button>'
  await page.getByRole('button').click()
})

test('expect assertion records a trace entry', async () => {
  document.body.innerHTML = '<button>World</button>'
  await expect.element(page.getByRole('button')).toHaveTextContent('World')
})
