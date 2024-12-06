import { createNode } from '#src/createNode'
import { page } from '@vitest/browser/context'
import { beforeEach, describe, expect, test } from 'vitest'
import '../src/button.css'

describe('dom related activity', () => {
  beforeEach(() => {
    document.body.style.background = '#f3f3f3'
    document.body.replaceChildren()
  })

  test('viewport works correctly', async () => {
    await page.viewport(800, 600)
    expect(window.innerWidth).toBe(800)
    expect(window.innerHeight).toBe(600)
  })

  test('element doesn\'t exist', async () => {
    await expect.element(page.getByText('empty')).not.toBeInTheDocument()
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

  test('shadow dom screenshot', async () => {
    const wrapper = createWrapper()
    const div = createNode()
    wrapper.appendChild(div)

    const shadow = div.attachShadow({ mode: 'open' })
    const shadowDiv = createNode()
    shadow.appendChild(shadowDiv)

    const screenshotPath = await page.screenshot({
      element: shadowDiv,
    })
    expect(screenshotPath).toMatch(
      /__screenshots__\/dom.test.ts\/dom-related-activity-shadow-dom-screenshot-1.png/,
    )
  })

  test('svg screenshot', async () => {
    const wrapper = createWrapper()
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', '100')
    svg.setAttribute('height', '100')
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    rect.setAttribute('width', '100')
    rect.setAttribute('height', '100')
    rect.setAttribute('fill', 'red')
    svg.appendChild(rect)
    wrapper.appendChild(svg)

    const screenshotPath = await page.screenshot({
      element: svg,
    })
    expect(screenshotPath).toMatch(
      /__screenshots__\/dom.test.ts\/dom-related-activity-svg-screenshot-1.png/,
    )
  })
})

function createWrapper() {
  document.body.style.background = '#f3f3f3'
  const wrapper = document.createElement('div')
  wrapper.className = 'wrapper'
  document.body.appendChild(wrapper)
  wrapper.style.height = '200px'
  wrapper.style.width = '200px'
  return wrapper
}
