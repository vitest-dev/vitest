import type { ViteNodeRunnerOptions } from 'vite-node'
import type { BuiltinEnvironment, VitestEnvironment } from '../../node/types/config'
import type { Environment } from '../../types/environment'
import type { ContextRPC, WorkerRPC } from '../../types/worker'
import { readFileSync } from 'node:fs'
import { normalize, resolve } from 'pathe'
import { ViteNodeRunner } from 'vite-node/client'
import { environments } from './index'

function isBuiltinEnvironment(
  env: VitestEnvironment,
): env is BuiltinEnvironment {
  return env in environments
}

const _loaders = new Map<string, ViteNodeRunner>()

export async function createEnvironmentLoader(options: ViteNodeRunnerOptions) {
  if (!_loaders.has(options.root)) {
    const loader = new ViteNodeRunner(options)
    await loader.executeId('/@vite/env')
    _loaders.set(options.root, loader)
  }
  return _loaders.get(options.root)!
}

export async function loadEnvironment(
  ctx: ContextRPC,
  rpc: WorkerRPC,
): Promise<Environment> {
  const name = ctx.environment.name
  if (isBuiltinEnvironment(name)) {
    return environments[name]
  }
  const loader = await createEnvironmentLoader({
    root: ctx.config.root,
    fetchModule: async (id) => {
      const result = await rpc.fetch(id, 'ssr')
      if (result.id) {
        return { code: readFileSync(result.id, 'utf-8') }
      }
      return result
    },
    resolveId: (id, importer) => rpc.resolveId(id, importer, 'ssr'),
  })
  const root = loader.root
  const packageId
    = name[0] === '.' || name[0] === '/'
      ? resolve(root, name)
      : (await rpc.resolveId(`vitest-environment-${name}`, undefined, 'ssr'))
          ?.id ?? resolve(root, name)
  const pkg = await loader.executeId(normalize(packageId))
  if (!pkg || !pkg.default || typeof pkg.default !== 'object') {
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
      + `Path "${packageId}" should export default object with a "setup" or/and "setupVM" method.`,
    )
  }
  const environment = pkg.default
  if (
    environment.transformMode !== 'web'
    && environment.transformMode !== 'ssr'
  ) {
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
      + `Path "${packageId}" should export default object with a "transformMode" method equal to "ssr" or "web".`,
    )
  }
  return environment
}
