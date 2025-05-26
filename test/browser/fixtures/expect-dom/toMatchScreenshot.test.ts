import { expect, test } from 'vitest'
import { page } from '@vitest/browser/context'

function addHelloWorldDiv() {
  const div = document.createElement('div')
  div.textContent = 'Hello, World!!'
  div.className = 'hello-world'
  div.style.fontSize = '24px'
  div.style.color = 'blue'
  div.style.textAlign = 'center'
  div.style.marginTop = '20px'
  document.body.appendChild(div)
}

test('body matches screenshot', async () => {
  addHelloWorldDiv()

  await expect(document.body).toMatchScreenshot()
})

test('div matches screenshot', async () => {
  addHelloWorldDiv()

  await expect(document.querySelector('.hello-world')).toMatchScreenshot()
})

test('div matches screenshot with locator', async () => {
  addHelloWorldDiv()
  const div = document.querySelector('.hello-world')

  expect(div).toBeDefined()
  await expect(page.elementLocator(div)).toMatchScreenshot()
})
