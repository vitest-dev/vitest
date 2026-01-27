import type { DevEnvironment } from 'vite'
import type { ResolvedConfig } from '../types/config'
import type { VitestFetchFunction } from './fetchModule'
import { readFile } from 'node:fs/promises'
import { VitestModuleEvaluator } from '#module-evaluator'
import { ModuleRunner } from 'vite/module-runner'
import { normalizeResolvedIdToUrl } from './normalizeUrl'

export class ServerModuleRunner extends ModuleRunner {
  constructor(
    private environment: DevEnvironment,
    fetcher: VitestFetchFunction,
    private config: ResolvedConfig,
  ) {
    super(
      {
        hmr: false,
        transport: {
          async invoke(event) {
            if (event.type !== 'custom') {
              throw new Error(`Vitest Module Runner doesn't support Vite HMR events.`)
            }
            const { name, data } = event.data
            if (name === 'getBuiltins') {
              return await environment.hot.handleInvoke(event)
            }
            if (name !== 'fetchModule') {
              return { error: new Error(`Unknown method: ${name}. Expected "fetchModule".`) }
            }
            try {
              const result = await fetcher(data[0], data[1], environment, false, data[2])
              if ('tmp' in result) {
                const code = await readFile(result.tmp)
                return { result: { ...result, code } }
              }
              return { result }
            }
            catch (error) {
              return { error }
            }
          },
        },
      },
      new VitestModuleEvaluator(),
    )
  }

  async import(rawId: string): Promise<any> {
    const resolved = await this.environment.pluginContainer.resolveId(
      rawId,
      this.config.root,
    )
    if (!resolved) {
      return super.import(rawId)
    }
    // Vite will make "@vitest/coverage-v8" into "@vitest/coverage-v8.js" url
    // instead of using an actual file path-like URL, so we resolve it here first
    const url = normalizeResolvedIdToUrl(this.environment, resolved.id)
    return super.import(url)
  }
}
