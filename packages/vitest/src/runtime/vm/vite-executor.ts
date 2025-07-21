import type vm from 'node:vm'
import type { RuntimeRPC } from '../../types/rpc'
import type { WorkerGlobalState } from '../../types/worker'
import type { EsmExecutor } from './esm-executor'
import type { VMModule } from './types'
import { pathToFileURL } from 'node:url'
import { CSS_LANGS_RE, KNOWN_ASSET_RE, toArray } from '@vitest/utils'
import { normalize } from 'pathe'
import { SyntheticModule } from './utils'

interface ViteExecutorOptions {
  context: vm.Context
  transform: RuntimeRPC['transform']
  esmExecutor: EsmExecutor
  viteClientModule: Record<string, unknown>
}

const CLIENT_ID = '/@vite/client'
const CLIENT_FILE = pathToFileURL(CLIENT_ID).href

export class ViteExecutor {
  private esm: EsmExecutor

  constructor(private options: ViteExecutorOptions) {
    this.esm = options.esmExecutor
  }

  public resolve = (identifier: string, parent: string): string | undefined => {
    if (identifier === CLIENT_ID) {
      if (this.workerState.environment.transformMode === 'web') {
        return identifier
      }
      const packageName = this.getPackageName(parent)
      throw new Error(
        `[vitest] Vitest cannot handle ${CLIENT_ID} imported in ${parent} when running in SSR environment. Add "${packageName}" to "ssr.noExternal" if you are using Vite SSR, or to "server.deps.inline" if you are using Vite Node.`,
      )
    }
  }

  get workerState(): WorkerGlobalState {
    return this.options.context.__vitest_worker__
  }

  private getPackageName(modulePath: string) {
    const path = normalize(modulePath)
    let name = path.split('/node_modules/').pop() || ''
    if (name?.startsWith('@')) {
      name = name.split('/').slice(0, 2).join('/')
    }
    else {
      name = name.split('/')[0]
    }
    return name
  }

  public async createViteModule(fileUrl: string): Promise<VMModule> {
    if (fileUrl === CLIENT_FILE || fileUrl === CLIENT_ID) {
      return this.createViteClientModule()
    }
    const cached = this.esm.resolveCachedModule(fileUrl)
    if (cached) {
      return cached
    }
    return this.esm.createEsModule(fileUrl, async () => {
      try {
        const result = await this.options.transform(fileUrl, 'web')
        if (result.code) {
          return result.code
        }
      }
      catch (cause: any) {
        // rethrow vite error if it cannot load the module because it's not resolved
        if (
          (typeof cause === 'object' && cause.code === 'ERR_LOAD_URL')
          || (typeof cause?.message === 'string' && cause.message.includes('Failed to load url'))
        ) {
          const error = new Error(
            `Cannot find module '${fileUrl}'`,
            { cause },
          ) as Error & { code: string }
          error.code = 'ERR_MODULE_NOT_FOUND'
          throw error
        }
      }

      throw new Error(
        `[vitest] Failed to transform ${fileUrl}. Does the file exist?`,
      )
    })
  }

  private createViteClientModule() {
    const identifier = CLIENT_ID
    const cached = this.esm.resolveCachedModule(identifier)
    if (cached) {
      return cached
    }
    const stub = this.options.viteClientModule
    const moduleKeys = Object.keys(stub)
    const module = new SyntheticModule(
      moduleKeys,
      function () {
        moduleKeys.forEach((key) => {
          this.setExport(key, stub[key])
        })
      },
      { context: this.options.context, identifier },
    )
    this.esm.cacheModule(identifier, module)
    return module
  }

  public canResolve = (fileUrl: string): boolean => {
    const environment = this.workerState.environment
    const viteEnvironment = environment.viteEnvironment || environment.name
    if (viteEnvironment !== 'client') {
      return false
    }
    if (fileUrl === CLIENT_FILE) {
      return true
    }
    const config = this.workerState.config.deps?.web || {}
    const [modulePath] = fileUrl.split('?')
    if (config.transformCss && CSS_LANGS_RE.test(modulePath)) {
      return true
    }
    if (config.transformAssets && KNOWN_ASSET_RE.test(modulePath)) {
      return true
    }
    if (
      toArray(config.transformGlobPattern).some(pattern =>
        pattern.test(modulePath),
      )
    ) {
      return true
    }
    return false
  }
}
