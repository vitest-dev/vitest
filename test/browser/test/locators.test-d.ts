import { test } from 'vitest'
import { page } from 'vitest/browser'

test('filter options are not accepted by getBy* methods', () => {
  // @ts-expect-error -- `hasText` is only supported by `.filter()`
  page.getByRole('button', { hasText: 'A' })
  // @ts-expect-error -- `hasText` is only supported by `.filter()`
  page.getByText('hello', { hasText: 'A' })

  page.getByRole('button').filter({ hasText: 'A' })
})
