import type { Ref } from 'vue'
import type { VueInstance } from '@vueuse/core'

const fileDetailsSizeSymbol = Symbol('file-details-size')

export function provideFileDetailsSize(target: Ref<VueInstance | null>) {
  const fileDetailsSize = ref<[number, number] | null>(null)
  provide(fileDetailsSizeSymbol, fileDetailsSize)
  useResizeObserver(target, () => {
    const el = target.value?.$el
    fileDetailsSize.value = el
      ? [el.clientWidth, el.clientHeight]
      : null
  })
}

export function injectFileDetailsSize(): Ref<[number, number] | null> {
  return inject<Ref<[number, number] | null>>(fileDetailsSizeSymbol)!
}
