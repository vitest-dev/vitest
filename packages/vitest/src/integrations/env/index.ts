import type { BuiltinEnvironment, VitestEnvironment } from '../../types/config'
import type { VitestExecutor } from '../../node'
import type { Environment } from '../../types'
import node from './node'
import jsdom from './jsdom'
import happy from './happy-dom'
import edge from './edge-runtime'

export const environments = {
  node,
  jsdom,
  'happy-dom': happy,
  'edge-runtime': edge,
}

export const envs = Object.keys(environments)

export const envPackageNames: Record<Exclude<keyof typeof environments, 'node'>, string> = {
  'jsdom': 'jsdom',
  'happy-dom': 'happy-dom',
  'edge-runtime': '@edge-runtime/vm',
}

function isBuiltinEnvironment(env: VitestEnvironment): env is BuiltinEnvironment {
  return env in environments
}

export function getEnvPackageName(env: VitestEnvironment) {
  if (env === 'node')
    return null
  if (env in envPackageNames)
    return (envPackageNames as any)[env]
  return `vitest-environment-${env}`
}

export async function loadEnvironment(name: VitestEnvironment, executor: VitestExecutor): Promise<Environment> {
  if (isBuiltinEnvironment(name))
    return environments[name]
  const packageId = (name[0] === '.' || name[0] === '/') ? name : `vitest-environment-${name}`
  const pkg = await executor.executeId(packageId)
  if (!pkg || !pkg.default || typeof pkg.default !== 'object' || typeof pkg.default.setup !== 'function') {
    throw new Error(
      `Environment "${name}" is not a valid environment. `
    + `Package "vitest-environment-${name}" should have default export with "setup" method.`,
    )
  }
  return pkg.default
}
