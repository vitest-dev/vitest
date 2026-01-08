import { expect, test } from 'vitest'

test('basic', () => {
  const div = document.createElement('div')
  div.textContent = 'Hello from persistent context test'
  document.body.appendChild(div)
  expect(document.body.textContent).toContain('Hello from persistent context test')
})
