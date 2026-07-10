import { test } from 'vitest'
import { page } from 'vitest/browser'

test('locators accept only their own query options', () => {
  page.getByRole('button', { name: 'Submit', exact: true })
  page.getByText('Submit', { exact: true })
  page.getByLabelText('Submit', { exact: true })
  page.getByPlaceholder('Submit', { exact: true })
  page.getByAltText('Submit', { exact: true })
  page.getByTitle('Submit', { exact: true })

  // @ts-expect-error use the `name` option or chain .filter() instead
  page.getByRole('button', { hasText: 'Submit' })
  // @ts-expect-error filter options belong to .filter()
  page.getByRole('button', { hasNotText: 'Submit' })
  // @ts-expect-error filter options belong to .filter()
  page.getByRole('button', { has: page.getByText('Submit') })
  // @ts-expect-error filter options belong to .filter()
  page.getByRole('button', { hasNot: page.getByText('Submit') })

  // @ts-expect-error filter options belong to .filter()
  page.getByText('Submit', { hasText: 'Submit' })
  // @ts-expect-error filter options belong to .filter()
  page.getByLabelText('Submit', { hasText: 'Submit' })
  // @ts-expect-error filter options belong to .filter()
  page.getByPlaceholder('Submit', { hasText: 'Submit' })
  // @ts-expect-error filter options belong to .filter()
  page.getByAltText('Submit', { hasText: 'Submit' })
  // @ts-expect-error filter options belong to .filter()
  page.getByTitle('Submit', { hasText: 'Submit' })
})

test('filter accepts only filter options', () => {
  page.getByRole('button').filter({ hasText: 'Submit' })
  page.getByRole('button').filter({ hasNotText: /Submit/ })
  page.getByRole('button').filter({ has: page.getByText('Submit') })
  page.getByRole('button').filter({ hasNot: page.getByText('Submit') })

  // @ts-expect-error `exact` is a query option, not a filter
  page.getByRole('button').filter({ exact: true })
})
