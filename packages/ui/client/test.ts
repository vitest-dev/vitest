import type { ComponentRenderOptions } from 'vitest-browser-vue'
import { vTooltip } from 'floating-vue'
import {
  render as _render,
} from 'vitest-browser-vue'

export { page } from 'vitest/browser'

export function render<C>(component: C, options?: ComponentRenderOptions<C, any>) {
  return _render(component, {
    ...options,
    global: {
      directives: {
        tooltip: vTooltip,
      },
    },
  })
}
