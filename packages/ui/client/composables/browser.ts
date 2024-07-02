export type ViewportSize =
  | 'small-mobile'
  | 'large-mobile'
  | 'tablet'
  | 'full'
  | 'custom'
export const viewport = ref<ViewportSize>('full')
export const customViewport = ref<[number, number]>()

export function onBrowserPanelResizing(isResizing: boolean) {
  const tester = document.querySelector<HTMLDivElement>('#tester-ui')
  if (!tester) {
    return
  }

  tester.style.pointerEvents = isResizing ? 'none' : ''
}
