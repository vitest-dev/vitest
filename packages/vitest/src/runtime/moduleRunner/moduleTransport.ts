import type { EvaluatedModuleNode, EvaluatedModules, FetchFunction, ModuleRunnerTransport } from 'vite/module-runner'
import type { ResolveFunctionResult } from '../../types/general'
import { EnvironmentTeardownError } from '../utils'

export interface VitestTransportOptions {
  fetchModule: FetchFunction
  resolveId: (id: string, importer?: string) => Promise<ResolveFunctionResult | null>
}

export class VitestTransport implements ModuleRunnerTransport {
  constructor(
    private options: VitestTransportOptions,
    private evaluatedModules: EvaluatedModules,
    private callstacks: WeakMap<EvaluatedModuleNode, string[]>,
  ) {}

  async invoke(event: any): Promise<{ result: any } | { error: any }> {
    if (event.type !== 'custom') {
      return { error: new Error(`Vitest Module Runner doesn't support Vite HMR events.`) }
    }
    if (event.event !== 'vite:invoke') {
      return { error: new Error(`Vitest Module Runner doesn't support ${event.event} event.`) }
    }
    const { name, data } = event.data
    if (name === 'getBuiltins') {
      // we return an empty array here to avoid client-side builtin check,
      // as we need builtins to go through `fetchModule`
      return { result: [] }
    }
    if (name !== 'fetchModule') {
      return { error: new Error(`Unknown method: ${name}. Expected "fetchModule".`) }
    }
    try {
      const result = await this.options.fetchModule(...data as Parameters<FetchFunction>)
      return { result }
    }
    catch (cause) {
      if (cause instanceof EnvironmentTeardownError) {
        const [id, importer] = data as Parameters<FetchFunction>
        let message = `Cannot load '${id}'${importer ? ` imported from ${importer}` : ''} after the environment was torn down. `
          + `This is not a bug in Vitest.`

        const moduleNode = importer ? this.evaluatedModules.getModuleById(importer) : undefined
        const callstack = moduleNode ? this.callstacks.get(moduleNode) : undefined
        if (callstack) {
          message += ` The last recorded callstack:\n- ${[...callstack, importer, id].reverse().join('\n- ')}`
        }
        const error = new EnvironmentTeardownError(message)
        if (cause.stack) {
          error.stack = cause.stack.replace(cause.message, error.message)
        }
        return { error }
      }
      return { error: cause }
    }
  }
}
