import { currentModule } from './navigation'
import { browser, hideSelectedTestBrowser, notifySelectedTestBrowser } from './client'

export const iFrameX = ref(0)

export function useIFramePosition() {
  watch(() => currentModule.value?.filepath, (filepath) => {
    notify(filepath, iFrameX.value)
  })

  watchDebounced(iFrameX, (x) => {
    notify(currentModule.value?.filepath, x)
  }, { debounce: 300 })

  onBeforeMount(() => {
    notify(currentModule.value?.filepath, iFrameX.value)
  })

  onBeforeUnmount(hideSelectedTestBrowser)

  return { iFrameX }
}

function notify(filepath?: string, x?: number) {
  if (browser.value && typeof x === 'number' && typeof filepath === 'string')
    notifySelectedTestBrowser(filepath, x)
}
