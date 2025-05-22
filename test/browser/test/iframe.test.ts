import { page } from '@vitest/browser/context'
import { beforeEach, describe, expect, test } from 'vitest'

describe('iframe functionality', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  test('creates a new page from iframe element', async () => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('name', 'test-iframe')
    iframe.srcdoc = `
      <div id="content">
        <p>Hello from iframe</p>
        <button>Click me</button>
      </div>
    `
    document.body.appendChild(iframe)

    await new Promise(resolve => iframe.onload = resolve)

    const iframePage = await page.createIframePage(iframe)

    const text = iframePage.getByText('Hello from iframe')
    await expect.element(text).toBeInTheDocument()
  })

  test('takes screenshot of iframe content', async () => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('name', 'test-iframe')
    iframe.srcdoc = `
      <div style="width: 200px; height: 200px; background: red;">
        <p>Content in iframe</p>
      </div>
    `
    document.body.appendChild(iframe)

    // Wait for iframe to load
    await new Promise(resolve => iframe.onload = resolve)

    const iframePage = await page.createIframePage(iframe)

    const screenshotPath = await iframePage.screenshot()
    expect(screenshotPath).toMatch(/__screenshots__\/iframe.test.ts\/iframe-functionality-takes-screenshot-of-iframe-content-1.png/)
  })

  test('takes base64 screenshot of iframe content', async () => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('name', 'test-iframe')
    iframe.srcdoc = `
      <div style="width: 200px; height: 200px; background: blue;">
        <p>Content in iframe</p>
      </div>
    `
    document.body.appendChild(iframe)

    await new Promise(resolve => iframe.onload = resolve)

    const iframePage = await page.createIframePage(iframe)

    // Take base64 screenshot
    const { path, base64 } = await iframePage.screenshot({ base64: true })
    expect(path).toMatch(/__screenshots__\/iframe.test.ts\/iframe-functionality-takes-base64-screenshot-of-iframe-content-1.png/)
    expect(base64).toBeTypeOf('string')
    expect(base64).toMatch(/^[A-Z0-9+/=]+$/i) // Base64 regex
  })

  test('handles nested iframes', async () => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('name', 'parent-iframe')
    iframe.srcdoc = `
      <iframe name="child-iframe" srcdoc="<p>Nested content</p>"></iframe>
    `
    document.body.appendChild(iframe)

    await new Promise(resolve => iframe.onload = resolve)

    const parentPage = await page.createIframePage(iframe)

    // Get child iframe element
    const childIframe = await parentPage.getByRole('presentation').element()

    // Create a page from child iframe
    const childPage = await parentPage.createIframePage(childIframe)

    // Test if we can access nested iframe content
    const text = childPage.getByText('Nested content')
    await expect.element(text).toBeInTheDocument()
  })

  test('handles iframe viewport', async () => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('name', 'test-iframe')
    iframe.srcdoc = `
      <div style="width: 100%; height: 100%;">
        <p>Content in iframe</p>
      </div>
    `
    document.body.appendChild(iframe)
    await new Promise(resolve => iframe.onload = resolve)

    const iframePage = await page.createIframePage(iframe)

    await iframePage.viewport(400, 300)

    // Verify viewport size
    const { width, height } = await iframePage.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }))
    expect(width).toBe(400)
    expect(height).toBe(300)
  })

  test('handles non-existent iframe', async () => {
    const nonExistentIframe = document.createElement('iframe')
    nonExistentIframe.setAttribute('name', 'non-existent')

    await expect(page.createIframePage(nonExistentIframe)).rejects.toThrow('Could not find iframe with the given element')
  })
})
