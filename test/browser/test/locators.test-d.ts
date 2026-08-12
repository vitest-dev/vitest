import { expectTypeOf, test } from 'vitest'
import { page } from 'vitest/browser'

test('filter-only options are not accepted by getBy* methods', () => {
  // `hasText`, `hasNotText`, `has` and `hasNot` are only implemented by `.filter()`.
  // They used to be part of `LocatorOptions`, which made them silently available
  // (and silently ignored) on every `getBy*` method.
  // https://github.com/vitest-dev/vitest/issues/10295

  // @ts-expect-error -- `hasText` is a filter-only option
  page.getByRole('button', { hasText: 'A' })
  // @ts-expect-error -- `hasNotText` is a filter-only option
  page.getByRole('button', { hasNotText: 'A' })
  // @ts-expect-error -- `has` is a filter-only option
  page.getByRole('button', { has: page.getByRole('img') })
  // @ts-expect-error -- `hasNot` is a filter-only option
  page.getByRole('button', { hasNot: page.getByRole('img') })
  // @ts-expect-error -- `hasText` is a filter-only option
  page.getByText('hello', { hasText: 'A' })
  // @ts-expect-error -- `hasText` is a filter-only option
  page.getByLabelText('hello', { hasText: 'A' })
  // @ts-expect-error -- `hasText` is a filter-only option
  page.getByAltText('hello', { hasText: 'A' })
  // @ts-expect-error -- `hasText` is a filter-only option
  page.getByPlaceholder('hello', { hasText: 'A' })
  // @ts-expect-error -- `hasText` is a filter-only option
  page.getByTitle('hello', { hasText: 'A' })
})

test('getBy* methods accept their own options', () => {
  expectTypeOf(page.getByRole).toBeCallableWith('button', { name: 'A', exact: true })
  expectTypeOf(page.getByRole).toBeCallableWith('heading', { level: 2 })
  expectTypeOf(page.getByRole).toBeCallableWith('checkbox', { checked: true })
  expectTypeOf(page.getByText).toBeCallableWith('hello', { exact: true })
  expectTypeOf(page.getByLabelText).toBeCallableWith('hello', { exact: true })
  expectTypeOf(page.getByAltText).toBeCallableWith('hello', { exact: true })
  expectTypeOf(page.getByPlaceholder).toBeCallableWith('hello', { exact: true })
  expectTypeOf(page.getByTitle).toBeCallableWith('hello', { exact: true })
})

test('filter accepts filter options, but not `exact`', () => {
  const locator = page.getByRole('button')

  expectTypeOf(locator.filter).toBeCallableWith({ hasText: 'A' })
  expectTypeOf(locator.filter).toBeCallableWith({ hasText: /A/ })
  expectTypeOf(locator.filter).toBeCallableWith({ hasNotText: 'A' })
  expectTypeOf(locator.filter).toBeCallableWith({ has: page.getByRole('img') })
  expectTypeOf(locator.filter).toBeCallableWith({ hasNot: page.getByRole('img') })

  // the documented way to narrow a role query down by text
  expectTypeOf(locator.filter({ hasText: 'A' })).toEqualTypeOf(locator)

  // @ts-expect-error -- `exact` is not a filter option
  locator.filter({ exact: true })
})
