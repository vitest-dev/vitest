import type { FetchFunction, ModuleRunnerTransport } from 'vite/module-runner'
import type { ResolveFunctionResult } from '../../types/general'
import { builtinModules } from 'node:module'

export interface VitestTransportOptions {
  fetchModule: FetchFunction
  getBuiltins?: () => Promise<(string | RegExp)[]>
  resolveId: (id: string, importer?: string) => Promise<ResolveFunctionResult | null>
}

const nodeBuiltins = builtinModules.filter(id => !id.includes(':'))

export class VitestTransport implements ModuleRunnerTransport {
  constructor(private options: VitestTransportOptions) {}

  async invoke(event: any): Promise<{ result: any } | { error: any }> {
    if (event.type !== 'custom') {
      return { error: new Error(`Vitest Module Runner doesn't support Vite HMR events.`) }
    }
    if (event.event !== 'vite:invoke') {
      return { error: new Error(`Vitest Module Runner doesn't support ${event.event} event.`) }
    }
    const { name, data } = event.data
    if (name === 'getBuiltins') {
      if (!this.options.getBuiltins) {
        return { result: [...nodeBuiltins, /^node:/] }
      }
      try {
        const result = await this.options.getBuiltins()
        return { result }
      }
      catch (error) {
        return { error }
      }
    }
    if (name !== 'fetchModule') {
      return { error: new Error(`Unknown method: ${name}. Expected "fetchModule".`) }
    }
    try {
      const result = await this.options.fetchModule(...data as Parameters<FetchFunction>)
      return { result }
    }
    catch (error) {
      return { error }
    }
  }
}
