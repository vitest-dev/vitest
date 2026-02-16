import type { BuiltinEnvironment, VitestEnvironment } from '../../node/types/config'
import type { Environment } from '../../types/environment'
import type { WorkerRPC } from '../../types/worker'
import type { Traces } from '../../utils/traces'
import { readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'pathe'
import { EvaluatedModules, ModuleRunner } from 'vite/module-runner'
import { VitestTransport } from '../../runtime/moduleRunner/moduleTransport'
import { environments } from './index'

function isBuiltinEnvironment(
  env: VitestEnvironment,
): env is BuiltinEnvironment {
  return env in environments
}

const isWindows = process.platform === 'win32'
const _loaders = new Map<string, ModuleRunner>()

export function createEnvironmentLoader(root: string, rpc: WorkerRPC): ModuleRunner {
  const cachedLoader = _loaders.get(root)
  if (!cachedLoader || cachedLoader.isClosed()) {
    _loaders.delete(root)

    const evaluatedModules = new EvaluatedModules()
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
          if (isWindows && 'externalize' in result) {
            // TODO: vitest returns paths for external modules, but Vite returns file://
            // https://github.com/vitejs/vite/pull/20449
            result.externalize = isBuiltin(id) || /^(?:node:|data:|http:|https:|file:)/.test(id)
              ? result.externalize
              : pathToFileURL(result.externalize).toString()
          }
          return result
        },
        async resolveId(id, importer) {
          return rpc.resolve(id, importer, '__vitest__')
        },
      }, evaluatedModules, new WeakMap()),
    })
    _loaders.set(root, moduleRunner)
  }
  return _loaders.get(root)!
}

export async function loadNativeEnvironment(
  name: string,
  root: string,
  traces: Traces,
): Promise<Environment> {
  const packageId = name[0] === '.' || name[0] === '/'
    ? pathToFileURL(resolve(root, name)).toString()
    : import.meta.resolve(`vitest-environment-${name}`, pathToFileURL(root).toString())
  const pkg = await traces.$(
    'vitest.runtime.environment.import',
    () => import(packageId) as Promise<{ default: Environment }>,
  )
  return resolveEnvironmentFromModule(name, packageId, pkg)
}

function resolveEnvironmentFromModule(name: string, packageId: string, pkg: { default: Environment }) {
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
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
      + `Path "${packageId}" should export default object with a "transformMode" method equal to "ssr" or "web", received "${environment.transformMode}".`,
    )
  }
  if (environment.transformMode) {
    console.warn(`The Vitest environment ${environment.name} defines the "transformMode". This options was deprecated in Vitest 4 and will be removed in the next major version. Please, use "viteEnvironment" instead.`)
    // keep for backwards compat
    environment.viteEnvironment ??= environment.transformMode === 'ssr'
      ? 'ssr'
      : 'client'
  }
  return environment
}

export async function loadEnvironment(
  name: string,
  root: string,
  rpc: WorkerRPC,
  traces: Traces,
  viteModuleRunner: boolean,
): Promise<{ environment: Environment; loader?: ModuleRunner }> {
  if (isBuiltinEnvironment(name)) {
    return { environment: environments[name] }
  }
  if (!viteModuleRunner) {
    return { environment: await loadNativeEnvironment(name, root, traces) }
  }
  const loader = createEnvironmentLoader(root, rpc)
  const packageId
    = name[0] === '.' || name[0] === '/'
      ? resolve(root, name)
      : (await traces.$(
          'vitest.runtime.environment.resolve',
          () => rpc.resolve(`vitest-environment-${name}`, undefined, '__vitest__'),
        ))
          ?.id ?? resolve(root, name)
  const pkg = await traces.$(
    'vitest.runtime.environment.import',
    () => loader.import(packageId) as Promise<{ default: Environment }>,
  )
  const environment = resolveEnvironmentFromModule(name, packageId, pkg)
  return {
    environment,
    loader,
  }
}
