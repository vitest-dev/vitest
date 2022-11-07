import { installSourcemapsSupport } from 'vite-node/source-map'
import { environments } from '../integrations/env'
import type { Environment, ResolvedConfig } from '../types'
import { clearTimeout, getWorkerState, isNode, setTimeout, toArray } from '../utils'
import * as VitestIndex from '../index'
import { resetRunOnceCounter } from '../integrations/run-once'
import { RealDate } from '../integrations/mock/date'
import { rpc } from './rpc'

let globalSetup = false
export async function setupGlobalEnv(config: ResolvedConfig) {
  resetRunOnceCounter()

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

  if (isNode) {
    const state = getWorkerState()

    installSourcemapsSupport({
      getSourceMap: source => state.moduleCache.getSourceMap(source),
    })

    await setupConsoleLogSpy()
  }

  if (config.globals)
    (await import('../integrations/globals')).registerApiGlobally()
}

function setupDefines(defines: Record<string, any>) {
  for (const key in defines)
    (globalThis as any)[key] = defines[key]
}

export async function setupConsoleLogSpy() {
  const stdoutBuffer = new Map<string, any[]>()
  const stderrBuffer = new Map<string, any[]>()
  const timers = new Map<string, { stdoutTime: number; stderrTime: number; timer: any }>()
  const unknownTestId = '__vitest__unknown_test__'

  const { Writable } = await import('stream')
  const { Console } = await import('console')

  // group sync console.log calls with macro task
  function schedule(taskId: string) {
    const timer = timers.get(taskId)!
    const { stdoutTime, stderrTime } = timer
    clearTimeout(timer.timer)
    timer.timer = setTimeout(() => {
      if (stderrTime < stdoutTime) {
        sendStderr(taskId)
        sendStdout(taskId)
      }
      else {
        sendStdout(taskId)
        sendStderr(taskId)
      }
    })
  }
  function sendStdout(taskId: string) {
    const buffer = stdoutBuffer.get(taskId)
    if (!buffer)
      return
    const content = buffer.map(i => String(i)).join('')
    if (!content.trim())
      return
    const timer = timers.get(taskId)!
    rpc().onUserConsoleLog({
      type: 'stdout',
      content,
      taskId,
      time: timer.stdoutTime || RealDate.now(),
      size: buffer.length,
    })
    stdoutBuffer.set(taskId, [])
    timer.stdoutTime = 0
  }
  function sendStderr(taskId: string) {
    const buffer = stderrBuffer.get(taskId)
    if (!buffer)
      return
    const content = buffer.map(i => String(i)).join('')
    if (!content.trim())
      return
    const timer = timers.get(taskId)!
    rpc().onUserConsoleLog({
      type: 'stderr',
      content,
      taskId,
      time: timer.stderrTime || RealDate.now(),
      size: buffer.length,
    })
    stderrBuffer.set(taskId, [])
    timer.stderrTime = 0
  }

  const stdout = new Writable({
    write(data, encoding, callback) {
      const id = getWorkerState()?.current?.id ?? unknownTestId
      let timer = timers.get(id)
      if (timer) {
        timer.stdoutTime = timer.stdoutTime || RealDate.now()
      }
      else {
        timer = { stdoutTime: RealDate.now(), stderrTime: RealDate.now(), timer: 0 }
        timers.set(id, timer)
      }
      let buffer = stdoutBuffer.get(id)
      if (!buffer) {
        buffer = []
        stdoutBuffer.set(id, buffer)
      }
      buffer.push(data)
      schedule(id)
      callback()
    },
  })
  const stderr = new Writable({
    write(data, encoding, callback) {
      const id = getWorkerState()?.current?.id ?? unknownTestId
      let timer = timers.get(id)
      if (timer) {
        timer.stderrTime = timer.stderrTime || RealDate.now()
      }
      else {
        timer = { stderrTime: RealDate.now(), stdoutTime: RealDate.now(), timer: 0 }
        timers.set(id, timer)
      }
      let buffer = stderrBuffer.get(id)
      if (!buffer) {
        buffer = []
        stderrBuffer.set(id, buffer)
      }
      buffer.push(data)
      schedule(id)
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

async function loadEnvironment(name: string) {
  const pkg = await import(`vitest-environment-${name}`)
  if (!pkg || !pkg.default || typeof pkg.default !== 'object' || typeof pkg.default.setup !== 'function') {
    throw new Error(
      `Environment "${name}" is not a valid environment. `
    + `Package "vitest-environment-${name}" should have default export with "setup" method.`,
    )
  }
  return pkg.default
}

export async function withEnv(
  name: ResolvedConfig['environment'],
  options: ResolvedConfig['environmentOptions'],
  fn: () => Promise<void>,
) {
  const config: Environment = (environments as any)[name] || await loadEnvironment(name)
  const env = await config.setup(globalThis, options)
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
    files.map(async (fsPath) => {
      getWorkerState().moduleCache.delete(fsPath)
      await import(fsPath)
    }),
  )
}
