import { getSafeTimers } from '@vitest/utils'
import type { Environment, EnvironmentOptions } from '../types'

export async function withEnv(
  environment: Environment,
  options: EnvironmentOptions,
  fn: () => Promise<void>,
) {
  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = environment.name
  const env = await environment.setup(globalThis, options)
  try {
    await fn()
  }
  finally {
    // Run possible setTimeouts, e.g. the onces used by ConsoleLogSpy
    const { setTimeout } = getSafeTimers()
    await new Promise(resolve => setTimeout(resolve))

    await env.teardown(globalThis)
  }
}
