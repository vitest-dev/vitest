import { Writable } from 'node:stream'
import { Console } from 'node:console'
import { getSafeTimers } from '@vitest/utils'
import { RealDate } from '../integrations/mock/date'
import type { WorkerGlobalState } from '../types'

export function createCustomConsole(state: WorkerGlobalState) {
  const stdoutBuffer = new Map<string, any[]>()
  const stderrBuffer = new Map<string, any[]>()
  const timers = new Map<string, { stdoutTime: number; stderrTime: number; timer: any }>()
  const unknownTestId = '__vitest__unknown_test__'

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
    state.rpc.onUserConsoleLog({
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
    state.rpc.onUserConsoleLog({
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
      const id = state?.current?.id ?? unknownTestId
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
      const id = state?.current?.id ?? unknownTestId
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
  return new Console({
    stdout,
    stderr,
    colorMode: true,
    groupIndentation: 2,
  })
}
