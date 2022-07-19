import type { Plugin as VitePlugin } from 'vite'

import type { Vitest } from '../core'

export function InstrumenterPlugin(ctx: Vitest): VitePlugin | null {
  // // Skip coverage reporters which do not need code transforms, e.g. native v8
  // TODO: This would be great but ctx has not yet been initialized
  // if (typeof ctx.coverageProvider.onFileTransform !== 'function')
  //  return null

  return {
    name: 'vitest:instrumenter',

    transform(srcCode, id) {
      return ctx.coverageProvider?.onFileTransform?.(srcCode, id, this)
    },
  }
}
