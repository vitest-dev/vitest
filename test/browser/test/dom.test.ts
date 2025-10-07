import { createNode } from '#src/createNode'
import { afterAll, beforeEach, describe, expect, test } from 'vitest'
import { page, server } from 'vitest/browser'
import '../src/button.css'

afterAll(() => {
  document.body.removeAttribute('style')
})

describe('dom related activity', () => {
  beforeEach(() => {
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

    // test typing
    if (0) {
      await expect.element(div).toHaveClass('x', { exact: true })
      await expect.element(div).toHaveClass('x', 'y')
      await expect.element(div).toHaveClass('x', /y/)
      await expect.element(div).toHaveClass(/x/, 'y')
      await expect.element(div).toHaveClass('x', /y/, 'z')
      await expect.element(div).toHaveClass(/x/, 'y', /z/)
      // @ts-expect-error error
      await expect.element(div).toHaveClass('x', { exact: 1234 })
      // @ts-expect-error error
      await expect.element(div).toHaveClass('x', 1234)
    }
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

  test('doesn\'t save base64', async () => {
    const wrapper = createWrapper()
    const div = createNode()
    wrapper.appendChild(div)

    const base64 = await page.screenshot({
      element: wrapper,
      save: false,
    })
    expect(base64).toBeTypeOf('string')
    expect(base64).not.toContain('__screenshots__')
    expect(base64).not.toContain('dom.test.ts')
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

  test.runIf(server.provider === 'webdriverio')('shadow dom works with multiple elements', async () => {
    const wrapper = createWrapper()
    const div = createNode()
    wrapper.appendChild(div)

    const shadow = div.attachShadow({ mode: 'open' })
    const shadowDiv1 = createNode()
    shadowDiv1.role = 'tab'
    const shadowDiv2 = createNode()
    shadowDiv2.role = 'tab'
    shadow.appendChild(shadowDiv1)
    shadow.appendChild(shadowDiv2)

    expect(
      page.getByRole('tab').selector,
      'there is only a single >>> in the selector',
    ).toBe('>>>html > body > div > div > div, html > body > div > div > div')
  })
})

function createWrapper() {
  const wrapper = document.createElement('div')
  wrapper.className = 'wrapper'
  document.body.appendChild(wrapper)
  wrapper.style.height = '200px'
  wrapper.style.width = '200px'
  return wrapper
}
