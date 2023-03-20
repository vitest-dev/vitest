import { expect, test } from 'vitest'

test('render div', async () => {
  const div = document.createElement('div')
  div.textContent = 'Hello World'
  document.body.appendChild(div)
  // TODO: test console
  // eslint-disable-next-line no-console
  console.log('hello world')
  console.error('error world')
  expect(div.textContent).toBe('Hello World')
})
