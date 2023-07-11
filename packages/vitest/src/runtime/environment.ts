import { environments } from '../integrations/env'
import type { Environment } from '../types'

export async function loadEnvironment(name: string, method: 'setup' | 'setupVM'): Promise<Environment> {
  if (name in environments)
    return environments[name as 'jsdom']
  const pkg = await import(`vitest-environment-${name}`)
  if (!pkg || !pkg.default || typeof pkg.default !== 'object') {
    throw new Error(
      `Environment "${name}" is not a valid environment. `
    + `Package "vitest-environment-${name}" should have default export with "${method}" method.`,
    )
  }
  if (typeof pkg.default[method] !== 'function') {
    throw new TypeError(
      `Environment "${name}" is not a valid environment. `
    + `Package "vitest-environment-${name}" doesn't support ${method === 'setupVM' ? 'vm' : 'non-vm'} environment because it doesn't provide "${method}" method.`,
    )
  }
  return pkg.default
}
