import { describe, expect, test } from 'vitest'
import { page } from '@vitest/browser/context'
import { createNode } from '#src/createNode'
import '../src/button.css'

describe('dom related activity', () => {
  test('renders div', async () => {
    document.body.style.background = '#f3f3f3'
    const wrapper = document.createElement('div')
    wrapper.className = 'wrapper'
    document.body.appendChild(wrapper)
    const div = createNode()
    wrapper.appendChild(div)
    expect(div.textContent).toBe('Hello World!')
    const screenshotPath = await page.screenshot({
      element: wrapper,
    })
    expect(screenshotPath).toMatch(
      /__screenshots__\/dom.test.ts\/dom-related-activity-renders-div-1.png/,
    )
  })
})
