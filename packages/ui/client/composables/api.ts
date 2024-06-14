import type { BrowserUI } from 'vitest'
import { findById } from './client'
import { customViewport, viewport } from './browser'
import { detailSizes } from '~/composables/navigation'

const ui: BrowserUI = {
  setCurrentFileId(fileId: string) {
    activeFileId.value = fileId
    currentModule.value = findById(fileId)
    showDashboard(false)
  },
  async setIframeViewport(width: number, height: number) {
    // reset the button before setting a custom viewport
    viewport.value = 'custom'
    customViewport.value = [width, height]
    await setIframeViewport(width, height)
  },
}

// @ts-expect-error not typed global
window.__vitest_ui_api__ = ui

function recalculateDetailPanels() {
  const iframe = getCurrentBrowserIframe()
  const panel = document.querySelector<HTMLDivElement>('#details-splitpanes')!
  const panelWidth = panel.clientWidth
  const iframeWidth = iframe.clientWidth
  const iframePercent = Math.min((iframeWidth / panelWidth) * 100, 95)
  const detailsPercent = 100 - iframePercent
  detailSizes.value = [iframePercent, detailsPercent]
}

export function getCurrentBrowserIframe() {
  return document.querySelector<HTMLIFrameElement>(
    '#tester-ui iframe[data-vitest]',
  )!
}

export async function setIframeViewport(
  width: number | string,
  height: number | string,
) {
  const iframe = getCurrentBrowserIframe()
  // change the viewport of the iframe
  iframe.style.width = typeof width === 'string' ? width : `${width}px`
  iframe.style.height = typeof height === 'string' ? height : `${height}px`
  // wait until it renders the new size and resize the panel to make the iframe visible
  // this will not make it fully visible if viewport is too wide, but it's better than nothing
  await new Promise(r => requestAnimationFrame(r))
  recalculateDetailPanels()
}
