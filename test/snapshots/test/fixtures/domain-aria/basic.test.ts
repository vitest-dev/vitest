// @vitest-environment happy-dom

import { expect, test } from 'vitest'

test('simple heading and paragraph', () => {
  document.body.innerHTML = '<h1>Hello World</h1><p>Some description</p>'
  expect(document.body).toMatchAriaSnapshot()
})

test('nested structure', () => {
  document.body.innerHTML = `
    <main>
      <h1>Dashboard</h1>
      <nav aria-label="Actions">
        <button>Save</button>
        <button>Cancel</button>
      </nav>
    </main>
  `
  expect(document.body).toMatchAriaSnapshot()
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <button aria-label="User 42">Profile</button>
    <p>You have 7 notifications</p>
  `
  expect(document.body).toMatchAriaSnapshot()
})
