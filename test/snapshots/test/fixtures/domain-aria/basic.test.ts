import { expect, test } from 'vitest'
import { ariaAdapter } from './basic'

expect.addSnapshotDomain(ariaAdapter)

test('simple heading and paragraph', () => {
  document.body.innerHTML = `
<h1>Hello World</h1>
<p>Some description</p>
`
  // expect(document.body).toMatchAriaSnapshot()
  expect(document.body).toMatchDomainSnapshot("aria")
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
  // expect(document.body).toMatchAriaSnapshot()
  expect(document.body).toMatchDomainSnapshot("aria")
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <p>Original</p>
    <button aria-label="1234">Pattern</button>
  `
  // expect(document.body).toMatchAriaSnapshot()
  expect(document.body).toMatchDomainSnapshot("aria")
})
