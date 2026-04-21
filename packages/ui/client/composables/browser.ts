import { ref, watch } from 'vue'

export type ViewportSize
  = | 'small-mobile'
    | 'large-mobile'
    | 'tablet'
export const viewport = ref<[number, number]>([414, 896])

watch([viewport], () => {
  document.body.style.setProperty('--viewport-width', `${viewport.value[0]}px`)
  document.body.style.setProperty('--viewport-height', `${viewport.value[1]}px`)
}, { immediate: true, flush: 'sync' })
