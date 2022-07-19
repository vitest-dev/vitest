import type { Plugin as VitePlugin } from 'vite'

import type { Vitest } from '../core'

export function InstrumenterPlugin(ctx: Vitest): VitePlugin | null {
  return {
    name: 'vitest:instrumenter',

    transform(srcCode, id) {
      return ctx.coverageProvider?.onFileTransform?.(srcCode, id, this)
    },
  }
}
