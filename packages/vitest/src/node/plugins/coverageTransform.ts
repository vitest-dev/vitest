import type { Plugin as VitePlugin } from 'vite'
import type { Vitest } from '../core'

import { normalizeRequestId } from 'vite-node/utils'

export function CoverageTransform(ctx: Vitest): VitePlugin {
  return {
    name: 'vitest:coverage-transform',
    transform(srcCode, id) {
      return ctx.coverageProvider?.onFileTransform?.(
        srcCode,
        normalizeRequestId(id),
        this,
      )
    },
  }
}
