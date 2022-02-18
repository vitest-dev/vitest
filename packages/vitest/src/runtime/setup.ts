import { Console } from 'console'
import { Writable } from 'stream'
import { environments } from '../integrations/env'
import { setupChai } from '../integrations/chai/setup'
import type { ResolvedConfig } from '../types'
import { toArray } from '../utils'
import { rpc } from './rpc'

let globalSetup = false
export async function setupGlobalEnv(config: ResolvedConfig) {
  // should be redeclared for each test
  // if run with "threads: false"
  setupDefines(config.defines)

  if (globalSetup)
    return

  globalSetup = true

  setupConsoleLogSpy()
  await setupChai()

  if (config.globals)
    (await import('../integrations/globals')).registerApiGlobally()
}

function setupDefines(defines: Record<string, any>) {
  for (const key in defines)
    (globalThis as any)[key] = defines[key]
}

export function setupConsoleLogSpy() {
  const stdout = new Writable({
    write(data, encoding, callback) {
      rpc().onUserConsoleLog({
        type: 'stdout',
        content: String(data),
        taskId: __vitest_worker__.current?.id,
        time: Date.now(),
      })
      callback()
    },
  })
  const stderr = new Writable({
    write(data, encoding, callback) {
      rpc().onUserConsoleLog({
        type: 'stderr',
        content: String(data),
        taskId: __vitest_worker__.current?.id,
        time: Date.now(),
      })
      callback()
    },
  })
  globalThis.console = new Console({
    stdout,
    stderr,
    colorMode: true,
    groupIndentation: 2,
  })
}

export async function withEnv(
  name: ResolvedConfig['environment'],
  options: ResolvedConfig['environmentOptions'],
  fn: () => Promise<void>,
) {
  const env = await environments[name].setup(globalThis, options)
  try {
    await fn()
  }
  finally {
    await env.teardown(globalThis)
  }
}

export async function runSetupFiles(config: ResolvedConfig) {
  const files = toArray(config.setupFiles)
  await Promise.all(
    files.map(async(file) => {
      __vitest_worker__.moduleCache.delete(file)
      await import(file)
    }),
  )
}
