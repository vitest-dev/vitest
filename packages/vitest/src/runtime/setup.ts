import { Console } from 'console'
import { Writable } from 'stream'
import { environments } from '../integrations/env'
import type { ResolvedConfig } from '../types'
import { toArray } from '../utils'
import * as VitestIndex from '../index'
import { rpc } from './rpc'

let globalSetup = false
export async function setupGlobalEnv(config: ResolvedConfig) {
  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

  // should be re-declared for each test
  // if run with "threads: false"
  setupDefines(config.defines)

  if (globalSetup)
    return

  globalSetup = true

  setupConsoleLogSpy()

  if (config.globals)
    (await import('../integrations/globals')).registerApiGlobally()
}

function setupDefines(defines: Record<string, any>) {
  for (const key in defines)
    (globalThis as any)[key] = defines[key]
}

export function setupConsoleLogSpy() {
  const stdoutBuffer: any[] = []
  const stderrBuffer: any[] = []
  let stdoutTime = 0
  let stderrTime = 0
  let timer: any

  // group sync console.log calls with macro task
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (stderrTime < stdoutTime) {
        sendStderr()
        sendStdout()
      }
      else {
        sendStdout()
        sendStderr()
      }
    })
  }
  function sendStdout() {
    if (stdoutBuffer.length) {
      rpc().onUserConsoleLog({
        type: 'stdout',
        content: stdoutBuffer.map(i => String(i)).join(''),
        taskId: __vitest_worker__.current?.id,
        time: stdoutTime || Date.now(),
      })
    }
    stdoutBuffer.length = 0
    stdoutTime = 0
  }
  function sendStderr() {
    if (stderrBuffer.length) {
      rpc().onUserConsoleLog({
        type: 'stderr',
        content: stderrBuffer.map(i => String(i)).join(''),
        taskId: __vitest_worker__.current?.id,
        time: stderrTime || Date.now(),
      })
    }
    stderrBuffer.length = 0
    stderrTime = 0
  }

  const stdout = new Writable({
    write(data, encoding, callback) {
      stdoutTime = stdoutTime || Date.now()
      stdoutBuffer.push(data)
      schedule()
      callback()
    },
  })
  const stderr = new Writable({
    write(data, encoding, callback) {
      stderrTime = stderrTime || Date.now()
      stderrBuffer.push(data)
      schedule()
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
