import { environments } from '../env'
import { setupChai } from '../integrations/chai/setup'
import type { ResolvedConfig } from '../types'

export async function setupGlobalEnv(config: ResolvedConfig) {
  await setupChai()

  if (config.global)
    (await import('../integrations/global')).registerApiGlobally()
}

export async function withEnv(name: ResolvedConfig['environment'], fn: () => Promise<void>) {
  const env = await environments[name].setup(globalThis)
  try {
    await fn()
  }
  finally {
    await env.teardown(globalThis)
  }
}
