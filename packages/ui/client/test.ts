import {
  type RenderOptions,
  render as _render,
  cleanup,
} from '@testing-library/vue'
import { VTooltip } from 'floating-vue'
import { afterEach } from 'vitest'

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

afterEach(() => {
  cleanup()
})

export { within, screen } from '@testing-library/vue'
