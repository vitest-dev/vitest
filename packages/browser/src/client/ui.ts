import type { BrowserUI } from 'vitest'

export function getUiAPI(): BrowserUI | undefined {
  // @ts-expect-error not typed global
  return window.__vitest_ui_api__
}
