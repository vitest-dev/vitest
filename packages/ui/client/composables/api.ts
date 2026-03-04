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
    await new Promise(r => requestAnimationFrame(r))
  },
}
