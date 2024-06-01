import { detailSizes } from '~/composables/navigation'

export type ResizingListener = (isResizing: boolean) => void

const resizingSymbol = Symbol.for('resizing')

export function recalculateDetailPanels() {
  const iframe = document.querySelector('#tester-ui iframe[data-vitest]')!
  const panel = document.querySelector('#details-splitpanes')!
  const panelWidth = panel.clientWidth
  const iframeWidth = iframe.clientWidth
  const iframePercent = Math.min((iframeWidth / panelWidth) * 100, 95)
  const detailsPercent = 100 - iframePercent
  detailSizes.value = [iframePercent, detailsPercent]
}

export function registerResizingListener(listener: ResizingListener) {
  inject<(listener: ResizingListener) => void>(resizingSymbol)?.(listener)
}

export function provideResizing() {
  const listeners = new Set<ResizingListener>()

  function addResizeListener(listener: ResizingListener) {
    listeners.add(listener)
  }

  function notifyResizing(isResizing: boolean) {
    for (const listener of listeners)
      listener(isResizing)
  }

  provide(resizingSymbol, addResizeListener)

  return { notifyResizing }
}
