// @vitest-environment happy-dom

import { expect, test } from 'vitest'

// --- TEST CASES ---
test('simple heading', () => {
  document.body.innerHTML = '<h1>Hello World</h1><p>Some description</p>'
  expect(document.body).toMatchAriaInlineSnapshot(`
    - heading [level=1]: Hello World
    - paragraph: Some description
  `)
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <button aria-label="User 42">Profile</button>
    <p>You have 7 notifications</p>
  `
  expect(document.body).toMatchAriaInlineSnapshot(`
    - button "User 42": Profile
    - paragraph: You have 7 notifications
  `)
})
