import { expect, expectTypeOf, test } from 'vitest'
import { page } from 'vitest/browser'

test('aria snapshot matchers return the assertion result', () => {
  expectTypeOf(expect(document.body).toMatchAriaSnapshot()).toEqualTypeOf<void>()
  expectTypeOf(expect(document.body).toMatchAriaInlineSnapshot('- heading')).toEqualTypeOf<void>()

  expectTypeOf(expect.element(page.getByRole('main')).toMatchAriaSnapshot()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot('- heading')).toEqualTypeOf<Promise<void>>()

  expectTypeOf(expect.poll(() => document.body).toMatchAriaSnapshot()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(expect.poll(() => document.body).toMatchAriaInlineSnapshot('- heading')).toEqualTypeOf<Promise<void>>()
})
