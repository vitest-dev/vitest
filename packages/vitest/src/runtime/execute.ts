import { ViteNodeRunner } from 'vite-node/client'
import type { ModuleCache, ViteNodeRunnerOptions } from 'vite-node'
import { normalizePath } from 'vite'
import type { MockMap } from '../types/mocker'
import { getWorkerState } from '../utils'
import { VitestMocker } from './mocker'

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  mockMap: MockMap
}

export async function executeInViteNode(options: ExecuteOptions & { files: string[] }) {
  const runner = new VitestRunner(options)

  // provide the vite define variable in this context
  await runner.executeId('/@vite/env')

  const result: any[] = []
  for (const file of options.files)
    result.push(await runner.executeFile(file))

  return result
}

export class VitestRunner extends ViteNodeRunner {
  mocker: VitestMocker
  entries = new Set<string>()

  constructor(public options: ExecuteOptions) {
    super(options)
    this.mocker = new VitestMocker(options, this.moduleCache)
  }

  prepareContext(context: Record<string, any>) {
    const request = context.__vite_ssr_import__
    const resolveId = context.__vitest_resolve_id__

    const mocker = this.mocker.withRequest(request)

    mocker.on('mocked', (dep: string, module: Partial<ModuleCache>) => {
      this.moduleCache.set(dep, module)
    })

    const workerState = getWorkerState()

    // support `import.meta.vitest` for test entry
    if (workerState.filepath && normalizePath(workerState.filepath) === normalizePath(context.__filename)) {
      // @ts-expect-error injected untyped global
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', { get: () => globalThis.__vitest_index__ })
    }

    return Object.assign(context, {
      __vite_ssr_import__: async (dep: string) => mocker.requestWithMock(await resolveId(dep)),
      __vite_ssr_dynamic_import__: async (dep: string) => mocker.requestWithMock(await resolveId(dep)),
      __vitest_mocker__: mocker,
    })
  }
}
