import type { BrowserUI } from 'vitest'
import { viewport } from './browser'
import { browserState, findById } from './client'
import { currentModule, showDashboard, updateBrowserPanel } from './navigation'
import { activeFileId } from './params'

export const ui: BrowserUI = {
  setCurrentFileId(fileId: string) {
    activeFileId.value = fileId
    currentModule.value = findById(fileId)
    showDashboard(false)
  },
  async setIframeViewport(width: number, height: number) {
    // reset the button before setting a custom viewport
    viewport.value = [width, height]
    if (browserState?.provider === 'webdriverio') {
      updateBrowserPanel()
    }
    await waitForAnimationFrame()
  },
}

const VIEWPORT_SETTLE_TIMEOUT = 250

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    let animationFrameId = 0
    const timeoutId = window.setTimeout(done, VIEWPORT_SETTLE_TIMEOUT)

    function done() {
      if (settled) {
        return
      }
      settled = true
      window.clearTimeout(timeoutId)
      window.cancelAnimationFrame(animationFrameId)
      resolve()
    }

    animationFrameId = window.requestAnimationFrame(done)
  })
}
