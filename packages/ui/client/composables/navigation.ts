import type { Ref } from 'vue'
import type { File } from '#types'

const currentModuleSymbol = Symbol('current-module')
const showSummarySymbol = Symbol('show-summary')

export function provideCurrentModule() {
  const currentModule = ref<File | undefined>(undefined)
  provide(currentModuleSymbol, currentModule)
  return currentModule
}

export function injectCurrentModule(): Ref<File | undefined> {
  return inject(currentModuleSymbol)!
}
export function provideShowSummary(showSummary: () => void) {
  provide(showSummarySymbol, showSummary)
}
export function injectShowSummary(): () => void {
  return inject(showSummarySymbol)!
}
