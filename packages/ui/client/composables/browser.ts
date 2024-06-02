import type { Ref } from 'vue'
import { detailSizes } from '~/composables/navigation'

type ResizingListener = (isResizing: boolean) => void

const resizingListeners = new Set<ResizingListener>()

export function recalculateDetailPanels() {
  const iframe = document.querySelector('#tester-ui iframe[data-vitest]')!
  const panel = document.querySelector('#details-splitpanes')!
  const panelWidth = panel.clientWidth
  const iframeWidth = iframe.clientWidth
  const iframePercent = Math.min((iframeWidth / panelWidth) * 100, 95)
  const detailsPercent = 100 - iframePercent
  detailSizes.value = [iframePercent, detailsPercent]
}

export function useResizing(testerRef: Ref<HTMLDivElement | undefined>) {
  function onResizing(isResizing: boolean) {
    const tester = testerRef.value
    if (!tester)
      return

    tester.style.pointerEvents = isResizing ? 'none' : ''
  }

  onMounted(() => {
    resizingListeners.add(onResizing)
  })

  onUnmounted(() => {
    resizingListeners.delete(onResizing)
  })

  return { recalculateDetailPanels }
}

export function useNotifyResizing() {
  function notifyResizing(isResizing: boolean) {
    for (const listener of resizingListeners)
      listener(isResizing)
  }

  return { notifyResizing }
}
