import { expect, test } from 'vitest'

test('simple heading and paragraph', () => {
  document.body.innerHTML = `
<h1>Hello World</h1>
<p>Some description</p>
`
  expect(document.body).toMatchAriaSnapshot()
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <p>Original</p>
    <button aria-label="1234">Pattern</button>
  `
  expect(document.body).toMatchAriaSnapshot()
})
