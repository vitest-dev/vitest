// @vitest-environment jsdom

import { expect, it } from 'vitest'

it('correctly resolves new assets URL paths', () => {
  const urlCss = new URL('../src/file-css.css', import.meta.url)
  expect(urlCss.toString()).toBe('http://localhost:3000/src/file-css.css')
})

it('correctly resolves aliased URL paths', () => {
  const urlAlias = new URL('#/file-css.css', import.meta.url)
  expect(urlAlias.toString()).toBe('http://localhost:3000/src/file-css.css')
})
