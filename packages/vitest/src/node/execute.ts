import { ViteNodeRunner } from 'vite-node/client'
import type { ModuleCache, ViteNodeRunnerOptions } from 'vite-node'
import type { SuiteMocks } from './mocker'
import { VitestMocker } from './mocker'

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  files: string[]
  mockMap: SuiteMocks
}

export async function executeInViteNode(options: ExecuteOptions) {
  const runner = new VitestRunner(options)

  const result: any[] = []
  for (const file of options.files)
    result.push(await runner.executeFile(file))

  return result
}

export class VitestRunner extends ViteNodeRunner {
  mocker: VitestMocker

  constructor(public options: ExecuteOptions) {
    super(options)

    options.requestStubs = options.requestStubs || {
      '/@vite/client': {
        injectQuery: (id: string) => id,
        createHotContext() {
          return {
            accept: () => {},
            prune: () => {},
          }
        },
        updateStyle() {},
      },
    }

    this.mocker = new VitestMocker(options, this.moduleCache)
  }

  prepareContext(context: Record<string, any>) {
    const request = context.__vite_ssr_import__

    const mocker = this.mocker.withRequest(request)

    mocker.on('mocked', (dep: string, module: Partial<ModuleCache>) => {
      this.setCache(dep, module)
    })

    return Object.assign(context, {
      __vite_ssr_import__: (dep: string) => mocker.requestWithMock(dep),
      __vite_ssr_dynamic_import__: (dep: string) => mocker.requestWithMock(dep),

      __vitest_mocker__: mocker,
    })
  }
}
