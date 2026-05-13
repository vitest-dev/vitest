import { vTooltip } from 'floating-vue'
import { vi } from 'vitest'
import {
  render as renderOriginal,
} from 'vitest-browser-vue'

export { page } from 'vitest/browser'

export const render: typeof renderOriginal = vi.defineHelper((component, options) => {
  return renderOriginal(component, {
    ...options,
    global: {
      directives: {
        tooltip: vTooltip,
      },
    },
  })
})
