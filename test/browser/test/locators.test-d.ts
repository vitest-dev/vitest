import { test } from 'vitest'
import { page } from 'vitest/browser'

test('locator query options do not include locator filters', () => {
  page.getByRole('button', { exact: true, name: 'Submit' })
  page.getByText('Submit', { exact: true })
  page.getByLabelText('Submit', { exact: true })
  page.getByAltText('Submit', { exact: true })
  page.getByPlaceholder('Submit', { exact: true })
  page.getByTitle('Submit', { exact: true })

  // @ts-expect-error -- use the accessible `name` option with getByRole instead
  page.getByRole('button', { hasText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByRole('button', { hasNotText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByRole('button', { has: page.getByText('Submit') })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByRole('button', { hasNot: page.getByText('Submit') })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByText('Submit', { hasText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByLabelText('Submit', { hasText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByAltText('Submit', { hasText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByPlaceholder('Submit', { hasText: 'Submit' })

  // @ts-expect-error -- locator filters should be chained with locator.filter()
  page.getByTitle('Submit', { hasText: 'Submit' })
})

test('locator filter options are separate from query options', () => {
  page.getByRole('button').filter({ hasText: 'Submit' })
  page.getByRole('button').filter({ hasNotText: /Submit/ })
  page.getByRole('button').filter({ has: page.getByText('Submit') })
  page.getByRole('button').filter({ hasNot: page.getByText('Submit') })

  // @ts-expect-error -- exact belongs to query options, not locator filters
  page.getByRole('button').filter({ exact: true })
})
