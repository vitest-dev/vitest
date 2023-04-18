import { environments } from '../integrations/env'
import type { Environment } from '../types'

export async function loadEnvironment(name: string, method: 'setup' | 'setupVM'): Promise<Environment> {
  if (name in environments)
    return environments[name as 'jsdom']
  const pkg = await import(`vitest-environment-${name}`)
  if (!pkg || !pkg.default || typeof pkg.default !== 'object' || typeof pkg.default[method] !== 'function') {
    throw new Error(
      `Environment "${name}" is not a valid environment. `
    + `Package "vitest-environment-${name}" should have default export with "${method}" method.`,
    )
  }
  return pkg.default
}
