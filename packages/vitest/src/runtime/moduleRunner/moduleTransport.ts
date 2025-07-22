import type { FetchFunction, ModuleRunnerTransport } from 'vite/module-runner'
import type { ResolveFunctionResult } from '../../types/general'

export interface VitestTransportOptions {
  fetchModule: FetchFunction
  resolveId: (id: string, importer?: string) => Promise<ResolveFunctionResult | null>
}

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
