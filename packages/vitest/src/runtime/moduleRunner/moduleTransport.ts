import type { FetchFunction } from 'vite/module-runner'

export interface VitestTransportOptions {
  fetchModule: FetchFunction
  resolveId: (id: string, importer?: string) => Promise<{
    id: string
    file: string
    url: string
  } | null>
}

export class VitestTransport {
  constructor(private options: VitestTransportOptions) {}

  async invoke(event: any): Promise<{ result: any }> {
    if (event.type !== 'custom') {
      throw new Error(`Vitest Module Runner doesn't support Vite HMR events.`)
    }
    if (event.event !== 'vite:invoke') {
      throw new Error(`Vitest Module Runner doesn't support ${event.event} event.`)
    }
    const { name, data } = event.data
    if (name !== 'fetchModule') {
      throw new Error(`Unknown method: ${name}. Expected "fetchModule".`)
    }
    const result = await this.options.fetchModule(...data as Parameters<FetchFunction>)
    return { result }
  }
}
