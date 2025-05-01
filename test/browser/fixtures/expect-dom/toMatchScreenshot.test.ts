import { expect, test } from 'vitest'

test('screenshot', () => {
  const div = document.createElement('div')
  div.textContent = 'Hello, World!'
  div.style.fontSize = '24px'
  div.style.color = 'blue'
  div.style.textAlign = 'center'
  div.style.marginTop = '20px'
  document.body.appendChild(div)

  expect(document.body).toMatchScreenshot()
})
