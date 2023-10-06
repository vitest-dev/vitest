import { normalize, resolve } from 'pathe'
import { resolvePath } from 'mlly'
import { ViteNodeRunner } from 'vite-node/client'
import type { ViteNodeRunnerOptions } from 'vite-node'
import type { BuiltinEnvironment, VitestEnvironment } from '../../types/config'
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
  if (env.startsWith('.') || env.startsWith('/'))
    return null
  return `vitest-environment-${env}`
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

export async function loadEnvironment(name: VitestEnvironment, options: ViteNodeRunnerOptions): Promise<Environment> {
  if (isBuiltinEnvironment(name))
    return environments[name]
  const loader = await createEnvironmentLoader(options)
  const root = loader.root
  const packageId = name[0] === '.' || name[0] === '/'
    ? resolve(root, name)
    : await resolvePath(`vitest-environment-${name}`, { url: [root] }) ?? resolve(root, name)
  const pkg = await loader.executeId(normalize(packageId))
  if (!pkg || !pkg.default || typeof pkg.default !== 'object') {
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
    + `Path "${packageId}" should export default object with a "setup" or/and "setupVM" method.`,
    )
  }
  const environment = pkg.default
  if (environment.transformMode !== 'web' && environment.transformMode !== 'ssr') {
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
    + `Path "${packageId}" should export default object with a "transformMode" method equal to "ssr" or "web".`,
    )
  }
  return environment
}
