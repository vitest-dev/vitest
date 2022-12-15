import { ViteNodeRunner } from 'vite-node/client'
import type { ViteNodeRunnerOptions } from 'vite-node'
import { normalizePath } from 'vite'
import type { MockMap } from '../types/mocker'
import { getWorkerState } from '../utils'
import { VitestMocker } from './mocker'

export interface ExecuteOptions extends ViteNodeRunnerOptions {
  mockMap: MockMap
}

export async function executeInViteNode(options: ExecuteOptions & { files: string[] }) {
  const runner = new VitestRunner(options)

  await runner.executeId('/@vite/env')
  await runner.mocker.initializeSpyModule()

  const result: any[] = []
  for (const file of options.files)
    result.push(await runner.executeFile(file))

  return result
}

export class VitestRunner extends ViteNodeRunner {
  public mocker: VitestMocker

  constructor(public options: ExecuteOptions) {
    super(options)

    this.mocker = new VitestMocker(this)
  }

  async resolveUrl(id: string, importee?: string) {
    if (importee && importee.startsWith('mock:'))
      importee = importee.slice(5)
    return super.resolveUrl(id, importee)
  }

  async dependencyRequest(id: string, fsPath: string, callstack: string[]): Promise<any> {
    const mocked = await this.mocker.requestWithMock(fsPath, callstack)

    if (typeof mocked === 'string')
      return super.dependencyRequest(mocked, mocked, callstack)
    if (mocked && typeof mocked === 'object')
      return mocked
    return super.dependencyRequest(id, fsPath, callstack)
  }

  prepareContext(context: Record<string, any>) {
    const workerState = getWorkerState()

    // support `import.meta.vitest` for test entry
    if (workerState.filepath && normalizePath(workerState.filepath) === normalizePath(context.__filename)) {
      // @ts-expect-error injected untyped global
      Object.defineProperty(context.__vite_ssr_import_meta__, 'vitest', { get: () => globalThis.__vitest_index__ })
    }

    return Object.assign(context, {
      __vitest_mocker__: this.mocker,
    })
  }
}
