import type { DevEnvironment } from 'vite'
import type { VitestResolver } from '../resolver'
import type { ResolvedConfig } from '../types/config'
import { VitestModuleEvaluator } from '#module-evaluator'
import { ModuleRunner } from 'vite/module-runner'
import { createFetchModuleFunction } from './fetchModule'
import { normalizeResolvedIdToUrl } from './normalizeUrl'

export class ServerModuleRunner extends ModuleRunner {
  constructor(
    private environment: DevEnvironment,
    resolver: VitestResolver,
    private config: ResolvedConfig,
  ) {
    const fetchModule = createFetchModuleFunction(
      resolver,
      false,
    )
    super(
      {
        hmr: false,
        sourcemapInterceptor: 'node',
        transport: {
          async invoke(event) {
            if (event.type !== 'custom') {
              throw new Error(`Vitest Module Runner doesn't support Vite HMR events.`)
            }
            const { data } = event.data
            try {
              const result = await fetchModule(data[0], data[1], environment, data[2])
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
    // In tests there is no problem because we control the first entry import
    const url = normalizeResolvedIdToUrl(this.environment, resolved.id)
    return super.import(url)
  }
}
