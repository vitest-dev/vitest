import { expect, test } from 'vitest'
import { ariaAdapter } from '../domain-aria/basic'

expect.addSnapshotDomain(ariaAdapter)

// --- TEST CASES ---
test('simple heading', () => {
  document.body.innerHTML = `
    <h1>Hello World</h1>
    <p>Some description</p>
  `
  expect(document.body).toMatchDomainInlineSnapshot(`
    - heading "Hello World" [level=1]
    - paragraph: Some description
  `, 'aria')
})

test('semantic match with regex in snapshot', () => {
  document.body.innerHTML = `
    <p>Original</p>
    <button aria-label="1234">Pattern</button>
  `
  expect(document.body).toMatchDomainInlineSnapshot(`
    - paragraph: Original
    - button "1234": Pattern
  `, 'aria')
})
