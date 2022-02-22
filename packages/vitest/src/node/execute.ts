import { ViteNodeRunner } from 'vite-node/client'
import type { ModuleCache, ViteNodeResolveId, ViteNodeRunnerOptions } from 'vite-node'
import type { SuiteMocks } from './mocker'
import { VitestMocker } from './mocker'

export type ResolveIdFunction = (id: string, importer?: string) => Promise<ViteNodeResolveId | null>

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  files: string[]
  mockMap: SuiteMocks
  resolveId: ResolveIdFunction
}

/**
 * 在 viteNode 中执行文件
 * @param options
 * @returns 返回结果
 */
export async function executeInViteNode(options: ExecuteOptions) {
  /** 创建一个 vitest runner */
  const runner = new VitestRunner(options)

  // provide the vite define variable in this context （引入vite环境）
  await runner.executeId('/@vite/env')

  const result: any[] = []
  for (const file of options.files)
    result.push(await runner.executeFile(file))

  return result
}

export class VitestRunner extends ViteNodeRunner {
  mocker: VitestMocker

  constructor(public options: ExecuteOptions) {
    super(options)
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
