import type { Plugin as VitePlugin } from 'vite'

import type { Vitest } from '../core'

export function CoverageTransform(ctx: Vitest): VitePlugin | null {
  return {
    name: 'vitest:coverage-transform',
    transform(srcCode, id) {
      return ctx.coverageProvider?.onFileTransform?.(srcCode, id, this)
    },
  }
}
