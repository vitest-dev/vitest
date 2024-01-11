import type { VitestEnvironment } from '../../types/config'
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

export function getEnvPackageName(env: VitestEnvironment) {
  if (env === 'node')
    return null
  if (env in envPackageNames)
    return (envPackageNames as any)[env]
  if (env[0] === '.' || env[0] === '/')
    return null
  return `vitest-environment-${env}`
}
