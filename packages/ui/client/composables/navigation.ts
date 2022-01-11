import type { Ref } from 'vue'
import { client, findById } from './client'
import { activeFileId } from './params'
import type { File } from '#types'

const currentModuleSymbol = Symbol('current-module')
const showSummarySymbol = Symbol('show-summary')
const summaryVisibleSymbol = Symbol('summary-visible')

export function initializeNavigation() {
  const route = useRoute()
  const currentModule = ref<File | undefined>(undefined)
  const summaryVisible = ref(true)
  if (route.hash) {
    const params = new URLSearchParams(route.hash.slice(1))
    if (params.has('file')) {
      const file = params.get('file')!
      if (file && file.length > 0) {
        const current = findById(file)
        if (current) {
          currentModule.value = current
          if (current?.id)
            activeFileId.value = current.id

          summaryVisible.value = false
        }
        else {
          watchOnce(
            () => client.state.getFiles(),
            () => {
              currentModule.value = findById(file)
              if (currentModule.value?.id)
                activeFileId.value = currentModule.value.id

              summaryVisible.value = false
            },
          )
        }
      }
    }
  }
  function showSummary(show: boolean) {
    summaryVisible.value = show
    if (show) {
      currentModule.value = undefined
      activeFileId.value = ''
    }
  }
  provide(showSummarySymbol, showSummary)
  provide(summaryVisibleSymbol, summaryVisible)
  provide(currentModuleSymbol, currentModule)

  return summaryVisible
}

export function injectCurrentModule(): Ref<File | undefined> {
  return inject(currentModuleSymbol)!
}
export function injectShowSummary(): (show: boolean) => void {
  return inject(showSummarySymbol)!
}
export function injectSummaryVisible(): Ref<boolean> {
  return inject(summaryVisibleSymbol)!
}
