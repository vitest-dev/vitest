import type { BuiltinEnvironment, VitestEnvironment } from '../../node/types/config'
import type { Environment } from '../../types/environment'
import type { ContextRPC, WorkerRPC } from '../../types/worker'
import { normalize, resolve } from 'pathe'
import { environments } from './index'

function isBuiltinEnvironment(
  env: VitestEnvironment,
): env is BuiltinEnvironment {
  return env in environments
}

export async function loadEnvironment(
  ctx: ContextRPC,
  rpc: WorkerRPC,
): Promise<Environment> {
  const name = ctx.environment.name
  if (isBuiltinEnvironment(name)) {
    return environments[name]
  }
  const root = ctx.config.root
  const packageId
    = name[0] === '.' || name[0] === '/'
      ? resolve(root, name)
      : (await rpc.resolve(`vitest-environment-${name}`, undefined, 'ssr'))
          ?.id ?? resolve(root, name)
  const pkg = await import(normalize(packageId))
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
