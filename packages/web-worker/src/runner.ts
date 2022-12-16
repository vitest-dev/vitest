import { VitestRunner } from 'vitest/node'

export class InlineWorkerRunner extends VitestRunner {
  constructor(options: any, private context: any) {
    super(options)
  }

  prepareContext(context: Record<string, any>) {
    const ctx = super.prepareContext(context)
    // not supported for now, we can't synchronously load modules
    const importScripts = () => {
      throw new Error('[vitest] `importScripts` is not supported in Vite workers. Please, consider using `import` instead.')
    }
    return Object.assign(ctx, this.context, {
      importScripts,
    })
  }
}
