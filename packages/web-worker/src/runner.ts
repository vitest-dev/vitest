import { VitestExecutor } from 'vitest/execute'

export class InlineWorkerRunner extends VitestExecutor {
  constructor(options: any, private context: any) {
    // share the same mocker as main executor
    const mocker = (globalThis as any).__vitest_mocker__
    super(options)
    this.mocker = (globalThis as any).__vitest_mocker__ = mocker
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
