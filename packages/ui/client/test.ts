import {
  render as _render,
  cleanup,
  type RenderOptions,
} from '@testing-library/vue'
import { vTooltip } from 'floating-vue'
import { afterEach } from 'vitest'

export function render<C>(component: C, options?: RenderOptions<C>) {
  return _render(component, {
    ...options,
    global: {
      directives: {
        tooltip: vTooltip,
      },
    },
  })
}

afterEach(() => {
  cleanup()
})

export { screen, within } from '@testing-library/vue'
