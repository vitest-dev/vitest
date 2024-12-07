import {
  render as _render,
  cleanup,
  type RenderOptions,
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

export { screen, within } from '@testing-library/vue'
