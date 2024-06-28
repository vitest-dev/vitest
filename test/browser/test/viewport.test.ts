import { page, server } from '@vitest/browser/context'
import { describe, expect, it } from 'vitest'

describe.skipIf(server.provider === 'preview')('viewport window has been properly initialized', () => {
  it.skipIf(!page.config.browser.headless)('viewport has proper width and size', () => {
    const { width, height } = page.config.browser.viewport
    const { width: actualWidth, height: actualHeight } = window.document.documentElement.getBoundingClientRect()

    // eslint-disable-next-line no-console
    console.log({ width, height, actualWidth, actualHeight })

    expect(actualWidth).toBe(width)
    expect(actualHeight).toBe(height)
  })

  it.skipIf(page.config.browser.headless)('window has been maximized', () => {
    let topWindow = window
    while (topWindow.parent && topWindow !== topWindow.parent) {
      topWindow = topWindow.parent as unknown as any
    }
    // eslint-disable-next-line no-console
    console.log({ availWidth: screen.availWidth, innerWidth: topWindow.innerWidth })

    expect(screen.availWidth - topWindow.innerWidth === 0).toBe(true)
  })
})
