import { createRequire } from 'node:module'
import { isatty } from 'node:tty'
import { installSourcemapsSupport } from 'vite-node/source-map'
import { createColors, setupColors } from '@vitest/utils'
import type { EnvironmentOptions, ResolvedConfig, ResolvedTestEnvironment } from '../types'
import { VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
import { getSafeTimers, getWorkerState } from '../utils'
import * as VitestIndex from '../index'
import { RealDate } from '../integrations/mock/date'
import { expect } from '../integrations/chai'
import { rpc } from './rpc'
import { setupCommonEnv } from './setup.common'

// this should only be used in Node
let globalSetup = false
export async function setupGlobalEnv(config: ResolvedConfig) {
  await setupCommonEnv(config)

  Object.defineProperty(globalThis, '__vitest_index__', {
    value: VitestIndex,
    enumerable: false,
  })

  const state = getWorkerState()

  if (!state.config.snapshotOptions.snapshotEnvironment)
    state.config.snapshotOptions.snapshotEnvironment = new VitestSnapshotEnvironment()

  if (globalSetup)
    return

  globalSetup = true
  setupColors(createColors(isatty(1)))

  const _require = createRequire(import.meta.url)
  // always mock "required" `css` files, because we cannot process them
  _require.extensions['.css'] = () => ({})
  _require.extensions['.scss'] = () => ({})
  _require.extensions['.sass'] = () => ({})
  _require.extensions['.less'] = () => ({})

  installSourcemapsSupport({
    getSourceMap: source => state.moduleCache.getSourceMap(source),
  })

  await setupConsoleLogSpy()
}

export async function setupConsoleLogSpy() {
  const stdoutBuffer = new Map<string, any[]>()
  const stderrBuffer = new Map<string, any[]>()
  const timers = new Map<string, { stdoutTime: number; stderrTime: number; timer: any }>()
  const unknownTestId = '__vitest__unknown_test__'

  const { Writable } = await import('node:stream')
  const { Console } = await import('node:console')
  const { setTimeout, clearTimeout } = getSafeTimers()

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
    const timer = timers.get(taskId)!
    rpc().onUserConsoleLog({
      type: 'stdout',
      content: content || '<empty line>',
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
    const timer = timers.get(taskId)!
    rpc().onUserConsoleLog({
      type: 'stderr',
      content: content || '<empty line>',
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

export async function withEnv(
  { environment, name }: ResolvedTestEnvironment,
  options: EnvironmentOptions,
  fn: () => Promise<void>,
) {
  // @ts-expect-error untyped global
  globalThis.__vitest_environment__ = name
  expect.setState({
    environment: name,
  })
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
