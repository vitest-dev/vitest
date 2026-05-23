import { test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

test('basic', async () => {
  document.body.innerHTML = `<button>hello</button>`
  await userEvent.click(page.getByRole('button'), { force: true })
  page.getByRole('button', { name: 'hello', exact: true })
  page.getByRole('button').filter({ hasText: 'hello' })

  // @ts-expect-error role locator options should not accept locator filters
  page.getByRole('button', { hasText: 'hello' })
  // @ts-expect-error role locator options should not accept locator filters
  page.getByRole('button', { has: page.getByText('hello') })
})
