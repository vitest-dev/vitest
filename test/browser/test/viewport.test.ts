import { describe, expect, it } from 'vitest'
import { page, server } from 'vitest/browser'

describe.skipIf(
  // preview cannot control viewport
  server.provider === 'preview'
  // other tests affect the viewport if they run in a different order
  || server.config.isolate === false,
)('viewport window has been properly initialized', () => {
  it.skipIf(!server.config.browser.headless)('viewport has proper size', () => {
    const { width, height } = server.config.browser.viewport
    const { width: actualWidth, height: actualHeight } = window.document.documentElement.getBoundingClientRect()

    expect(actualWidth).toBe(width)
    expect(actualHeight).toBe(height)
  })

  it.skipIf(server.config.browser.headless)('window has been maximized', () => {
    let topWindow = window
    while (topWindow.parent && topWindow !== topWindow.parent) {
      topWindow = topWindow.parent as unknown as any
    }

    // edge will show the Hub Apps right panel
    if (server.browser === 'edge') {
      expect(topWindow.visualViewport.width - topWindow.innerWidth === 0).toBe(true)
    }
    else {
      expect(screen.availWidth - topWindow.innerWidth === 0).toBe(true)
    }
  })
})

describe.skipIf(
  // preview cannot control viewport
  server.provider === 'preview',
)('viewport is scoped to the test that asks for it', () => {
  it('resizes the viewport', async () => {
    await page.viewport(320, 568)

    expect(window.innerWidth).toBe(320)
    expect(window.innerHeight).toBe(568)
  })

  // must run after the test above, so the order matters here
  it('restores the previous size for the tests that follow', () => {
    const { width, height } = server.config.browser.viewport

    expect(window.innerWidth).toBe(width)
    expect(window.innerHeight).toBe(height)
  })
})
