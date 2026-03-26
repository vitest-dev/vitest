import { expect, test } from 'vitest'

// --- TEST CASES ---
test('simple heading', () => {
  document.body.innerHTML = `
    <h1>Hello World</h1>
    <p>Some description</p>
  `
  expect(document.body).toMatchAriaInlineSnapshot(`
    - heading "Hello World" [level=1]
    - paragraph: Some description
  `)
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <p>Original</p>
    <button aria-label="1234">Pattern</button>
  `
  expect(document.body).toMatchAriaInlineSnapshot(`
    - paragraph: Original
    - button "1234": Pattern
  `)
})
