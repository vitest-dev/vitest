import { VitestExecutor } from 'vitest/node'

export class InlineWorkerExecutor extends VitestExecutor {
  constructor(config: any, options: any, private context: any) {
    super(config, options)
  }

  prepareContext(mod: any, context: Record<string, any>) {
    const ctx = super.prepareContext(mod, context)
    // not supported for now, we can't synchronously load modules
    const importScripts = () => {
      throw new Error('[vitest] `importScripts` is not supported in Vite workers. Please, consider using `import` instead.')
    }
    return Object.assign(ctx, this.context, {
      importScripts,
    })
  }
}
