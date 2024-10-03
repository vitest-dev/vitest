import type { ExecuteOptions } from 'vitest/execute'
import { VitestExecutor } from 'vitest/execute'

export class InlineWorkerRunner extends VitestExecutor {
  constructor(options: ExecuteOptions, private context: any) {
    super(options)
  }

  prepareContext(context: Record<string, any>) {
    const ctx = super.prepareContext(context)
    // not supported for now, we can't synchronously load modules
    return Object.assign(ctx, this.context, {
      importScripts,
    })
  }
}

function importScripts() {
  throw new Error(
    '[vitest] `importScripts` is not supported in Vite workers. Please, consider using `import` instead.',
  )
}
