// @vitest-environment jsdom

import { expect, test } from 'vitest'

test('matches aria snapshot for a DOM element', () => {
  document.body.innerHTML = `
    <section role="region" aria-label="Settings">
      <button aria-disabled="true">Save</button>
    </section>
  `

  const element = document.querySelector('section')!

  expect(element).toMatchAriaSnapshot(`
    - region "Settings"
      - button "Save" [disabled=true]
      - text "Save"
  `)
})

test('supports partial semantic matching', () => {
  document.body.innerHTML = `
    <section role="region" aria-label="Settings">
      <button aria-disabled="true">Save</button>
    </section>
  `

  const element = document.querySelector('section')!

  expect(element).toMatchAriaSnapshot(`
    - button "Save" [disabled=true]
  `)
})

test('throws on non-element value', () => {
  expect(() => {
    expect('text').toMatchAriaSnapshot()
  }).toThrowErrorMatchingInlineSnapshot(`
    [Error: toMatchAriaSnapshot expects a DOM Element as received value.]
  `)
})
