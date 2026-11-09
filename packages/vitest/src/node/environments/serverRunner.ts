import type { DevEnvironment, ViteDevServer } from 'vite'
import type { FetchCachedFileSystemResult, VitestFetchResult } from '../../types/general'
import type { ResolvedConfig } from '../types/config'
import type { ModuleTransformService } from './transformService'
import { readFile } from 'node:fs/promises'
import { isRunnableDevEnvironment } from 'vite'
import { ModuleRunner } from 'vite/module-runner'
import { VitestModuleEvaluator } from '#module-evaluator'
import { VitestEvaluatedModules } from '../../runtime/moduleRunner/evaluatedModules'
import { splitSourceMap, withInlineSourceMap } from '../../utils/moduleSourceMap'
import { normalizeResolvedIdToUrl } from './normalizeUrl'

export class ServerModuleRunner extends ModuleRunner {
  constructor(
    private environment: DevEnvironment,
    transformService: ModuleTransformService,
    private config: ResolvedConfig,
  ) {
    super(
      {
        hmr: false,
        evaluatedModules: new VitestEvaluatedModules(),
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
              let result: VitestFetchResult | FetchCachedFileSystemResult =
                await transformService.fetch(data[0], data[1], environment, false, data[2])
              if ('tmp' in result) {
                const { code, sourceMap } = splitSourceMap(await readFile(result.tmp, 'utf-8'))
                result = { ...result, code, sourceMap }
              }
              return {
                result: config.inspector.openInMainProcess ? withInlineSourceMap(result) : result,
              }
            } catch (error) {
              return { error }
            }
          },
        },
      },
      new VitestModuleEvaluator(),
    )
  }

  async import(rawId: string): Promise<any> {
    const resolved = await this.environment.pluginContainer.resolveId(rawId, this.config.root)
    if (!resolved) {
      return super.import(rawId)
    }
    // Vite will make "@vitest/coverage-v8" into "@vitest/coverage-v8.js" url
    // instead of using an actual file path-like URL, so we resolve it here first
    const url = normalizeResolvedIdToUrl(this.environment, resolved.id)
    return super.import(url)
  }
}

// Override the SSR environment's runner so user `configureServer` hooks that
// call `server.environments.ssr.runner.import(...)` get Vitest's module runner.
export function installSsrModuleRunner(
  server: ViteDevServer,
  transformService: ModuleTransformService,
  config: ResolvedConfig,
): void {
  const ssrEnvironment = server.environments.ssr
  if (!isRunnableDevEnvironment(ssrEnvironment)) {
    return
  }
  const ssrRunner = new ServerModuleRunner(ssrEnvironment, transformService, config)
  Object.defineProperty(ssrEnvironment, 'runner', {
    value: ssrRunner,
    writable: true,
    configurable: true,
  })
}
