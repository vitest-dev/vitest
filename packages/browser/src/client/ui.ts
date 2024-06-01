import type { File } from '@vitest/runner'

interface UiAPI {
  currentModule: File
  setCurrentById: (fileId: string) => void
  resetDetailSizes: () => void
  recalculateDetailPanels: () => void
}

export function getUiAPI(): UiAPI | undefined {
  // @ts-expect-error not typed global
  return window.__vitest_ui_api__
}
