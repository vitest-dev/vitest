import { test } from 'vitest'
import { page } from 'vitest/browser'

test('getByRole options do not include locator filters', () => {
  page.getByRole('button', { exact: true, name: 'Submit' })

  // @ts-expect-error -- use the accessible `name` option with getByRole instead
  page.getByRole('button', { hasText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByRole('button', { hasNotText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByRole('button', { has: page.getByText('Submit') })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByRole('button', { hasNot: page.getByText('Submit') })
})
