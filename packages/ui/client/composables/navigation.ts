import type { Ref } from 'vue'
import { client, findById } from './client'
import { activeFileId } from './params'
import type { File } from '#types'

const currentModuleSymbol = Symbol('current-module')
const showSummarySymbol = Symbol('show-summary')

export function provideCurrentModule() {
  const route = useRoute()
  const currentModule = ref<File | undefined>(undefined)
  if (route.hash) {
    const params = new URLSearchParams(route.hash.slice(1))
    if (params.has('file')) {
      const file = params.get('file')!
      const current = findById(file)
      if (current) {
        activeFileId.value = file
        currentModule.value = current
      }
      else {
        watchOnce(
          () => client.state.getFiles(),
          () => {
            activeFileId.value = file
            currentModule.value = findById(file)
          },
        )
      }
    }
  }
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
