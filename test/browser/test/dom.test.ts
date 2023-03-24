import { expect, test } from 'vitest'

test('render div', async () => {
  const div = document.createElement('div')
  div.textContent = 'Hello World'
  document.body.appendChild(div)
  expect(div.textContent).toBe('Hello World')
})
