import { beforeEach, describe, expect, test } from 'vitest'
import { page } from '@vitest/browser/context'
import { createNode } from '#src/createNode'
import '../src/button.css'

describe('dom related activity', () => {
  beforeEach(() => {
    document.body.style.background = '#f3f3f3'
    document.body.replaceChildren()
  })

  test('renders div', async () => {
    const wrapper = createWrapper()
    const div = createNode()
    wrapper.appendChild(div)

    await expect.element(div).toHaveTextContent('Hello World!')
    const screenshotPath = await page.screenshot({
      element: wrapper,
    })
    expect(screenshotPath).toMatch(
      /__screenshots__\/dom.test.ts\/dom-related-activity-renders-div-1.png/,
    )
  })

  test('resolves base64 screenshot', async () => {
    const wrapper = createWrapper()
    const div = createNode()
    wrapper.appendChild(div)

    const { path, base64 } = await page.screenshot({
      element: wrapper,
      base64: true,
    })
    expect(path).toMatch(
      /__screenshots__\/dom.test.ts\/dom-related-activity-resolves-base64-screenshot-1.png/,
    )
    expect(base64).toBeTypeOf('string')
  })
})

function createWrapper() {
  document.body.style.background = '#f3f3f3'
  const wrapper = document.createElement('div')
  wrapper.className = 'wrapper'
  document.body.appendChild(wrapper)
  return wrapper
}
