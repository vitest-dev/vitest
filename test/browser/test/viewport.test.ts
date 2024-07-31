import { server } from '@vitest/browser/context'
import { describe, expect, it } from 'vitest'

describe.skipIf(server.provider === 'preview')('viewport window has been properly initialized', () => {
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
