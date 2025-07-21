import type { BuiltinEnvironment, VitestEnvironment } from '../../node/types/config'
import type { Environment } from '../../types/environment'
import type { ContextRPC, WorkerRPC } from '../../types/worker'
import { readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { ModuleRunner } from 'vite/module-runner'
import { VitestTransport } from '../../runtime/moduleRunner/moduleTransport'
import { environments } from './index'

function isBuiltinEnvironment(
  env: VitestEnvironment,
): env is BuiltinEnvironment {
  return env in environments
}

const _loaders = new Map<string, ModuleRunner>()

export async function createEnvironmentLoader(root: string, rpc: WorkerRPC): Promise<ModuleRunner> {
  const cachedLoader = _loaders.get(root)
  if (!cachedLoader || cachedLoader.isClosed()) {
    _loaders.delete(root)

    const moduleRunner = new ModuleRunner({
      hmr: false,
      sourcemapInterceptor: 'prepareStackTrace',
      transport: new VitestTransport({
        async fetchModule(id, importer, options) {
          const result = await rpc.fetch(id, importer, '__vitest__', options)
          if ('cached' in result) {
            const code = readFileSync(result.tmp, 'utf-8')
            return { code, ...result }
          }
          return result
        },
        async resolveId(id, importer) {
          return rpc.resolve(id, importer, '__vitest__')
        },
      }),
    })
    _loaders.set(root, moduleRunner)
    await moduleRunner.import('/@vite/env')
  }
  return _loaders.get(root)!
}

export async function loadEnvironment(
  ctx: ContextRPC,
  rpc: WorkerRPC,
): Promise<{ environment: Environment; loader?: ModuleRunner }> {
  const name = ctx.environment.name
  if (isBuiltinEnvironment(name)) {
    return { environment: environments[name] }
  }
  const root = ctx.config.root
  const loader = await createEnvironmentLoader(root, rpc)
  const packageId
    = name[0] === '.' || name[0] === '/'
      ? resolve(root, name)
      : (await rpc.resolve(`vitest-environment-${name}`, undefined, 'ssr'))
          ?.id ?? resolve(root, name)
  const pkg = await loader.import(packageId) as { default: Environment }
  if (!pkg || !pkg.default || typeof pkg.default !== 'object') {
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
      + `Path "${packageId}" should export default object with a "setup" or/and "setupVM" method.`,
    )
  }
  const environment = pkg.default
  if (
    environment.transformMode != null
    && environment.transformMode !== 'web'
    && environment.transformMode !== 'ssr'
  ) {
    console.warn(`The Vitest environment ${environment.name} defines the "transformMode". This options was deprecated in Vitest 4 and will be removed in the next major version.`)
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
      + `Path "${packageId}" should export default object with a "transformMode" method equal to "ssr" or "web", received "${environment.transformMode}".`,
    )
  }
  if (environment.transformMode) {
    // keep for backwards compat
    environment.viteEnvironment ??= environment.transformMode === 'ssr'
      ? 'ssr'
      : 'client'
  }
  return {
    environment,
    loader,
  }
}
