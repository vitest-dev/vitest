import { type RenderOptions, render as _render } from '@testing-library/vue'
import { VTooltip } from 'floating-vue'

export function render(component: any, options?: RenderOptions) {
  return _render(component, {
    ...options,
    global: {
      directives: {
        tooltip: VTooltip,
      },
    },
  })
}

export { within, screen, cleanup } from '@testing-library/vue'
