import { expect, test } from 'vitest'
import { ariaAdapter } from './basic'

expect.addSnapshotDomain(ariaAdapter)

test('simple heading and paragraph', () => {
  document.body.innerHTML = `
<h1>Hello World</h1>
<p>Some description</p>
`
  expect(document.body).toMatchDomainSnapshot("aria")
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <p>Original</p>
    <button aria-label="1234">Pattern</button>
  `
  expect(document.body).toMatchDomainSnapshot("aria")
})
