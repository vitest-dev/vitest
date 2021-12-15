// TODO setImmediate, nextTick, requestAnimationFrame, cancelAnimationFrame
// TODO async timers

import { spyOn } from 'tinyspy'
import type { Spy } from 'tinyspy'

const originalSetTimeout = global.setTimeout
const originalSetInterval = global.setInterval
const originalClearTimeout = global.clearTimeout
const originalClearInterval = global.clearInterval

type Arguments = [cb: (args: void) => void, ms?: number | undefined]

const MAX_LOOPS = 10_000

type FakeCall = { cb: () => void; ms: number; id: number; nestedMs: number }

enum QueueTaskType {
  Interval = 'interval',
  Timeout = 'timeout',
  Immediate = 'immediate'
}

interface QueueTask {
  type: QueueTaskType
  call: FakeCall
  nested: boolean
}

const assertEvery = (assertions: any[], message: string) => {
  if (assertions.some(a => !a))
    throw new Error(message)
}

const assertMaxLoop = (times: number) => {
  if (times >= MAX_LOOPS)
    throw new Error('setTimeout/setInterval called 10 000 times. It\'s possible it stuck in an infinite loop.')
}

const getNodeTimeout = (id: number): NodeJS.Timeout => {
  const timer = {
    ref: () => timer,
    unref: () => timer,
    hasRef: () => true,
    refresh: () => timer,
    [Symbol.toPrimitive]: () => id,
  }

  return timer
}

export class FakeTimers {
  private _setTimeout!: Spy<Arguments, NodeJS.Timeout>
  private _setInterval!: Spy<Arguments, NodeJS.Timeout>

  private _clearTimeout!: Spy<[number | NodeJS.Timeout | undefined], void>
  private _clearInterval!: Spy<[number | NodeJS.Timeout | undefined], void>

  private _advancedTime = 0
  private _nestedTime: Record<string, number> = {}
  private _scopeId = 0
  private _isNested = false
  private _isOnlyPending = false

  private _spyid = 0

  private _isMocked = false

  private _tasksQueue: QueueTask[] = []
  private _queueCount = 0

  public useFakeTimers() {
    this._isMocked = true

    this.reset()

    const spyFactory = (spyType: QueueTaskType, resultBuilder: (id: number, cb: (args: void) => void) => any) => {
      return (cb: (args: void) => void, ms = 0) => {
        const id = ++this._spyid
        const nestedMs = ms + (this._nestedTime[this._scopeId] ?? 0)
        const call = { id, cb, ms, nestedMs, scopeId: this._scopeId }
        const task = { type: spyType, call, nested: this._isNested }

        this.pushTask(task)

        return resultBuilder(id, cb)
      }
    }

    this._setTimeout = spyOn(global, 'setTimeout').willCall(spyFactory(QueueTaskType.Timeout, getNodeTimeout))
    this._setInterval = spyOn(global, 'setInterval').willCall(spyFactory(QueueTaskType.Interval, getNodeTimeout))

    const clearTimerFactory = (spyType: QueueTaskType) => (id: number | undefined | NodeJS.Timeout) => {
      if (id === undefined) return

      const index = this._tasksQueue.findIndex(({ call, type }) => type === spyType && call.id === Number(id))

      if (index !== -1)
        this._tasksQueue.splice(index, 1)
    }

    this._clearTimeout = spyOn(global, 'clearTimeout', clearTimerFactory(QueueTaskType.Timeout))
    this._clearInterval = spyOn(global, 'clearInterval', clearTimerFactory(QueueTaskType.Interval))
  }

  public useRealTimers() {
    this._isMocked = false

    this.reset()

    global.setTimeout = originalSetTimeout
    global.setInterval = originalSetInterval
    global.clearTimeout = originalClearTimeout
    global.clearInterval = originalClearInterval
  }

  public runOnlyPendingTimers() {
    this.assertMocked()

    this._isOnlyPending = true
    this.runQueue()
  }

  public runAllTimers() {
    this.assertMocked()

    this.runQueue()
  }

  public advanceTimersByTime(ms: number) {
    this.assertMocked()

    this._advancedTime += ms
    this.runQueue()
  }

  public advanceTimersToNextTimer() {
    throw new Error('advanceTimersToNextTimer is not implemented')
  }

  public runAllTicks() {
    throw new Error('runAllTicks is not implemented')
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setSystemTime(now?: number | Date): void {
    throw new Error('setSystemTime is not implemented')
  }

  public getRealSystemTime(): number {
    return Date.now()
  }

  public getTimerCount(): number {
    this.assertMocked()

    return this._tasksQueue.length
  }

  private reset() {
    this._advancedTime = 0
    this._nestedTime = {}
    this._isNested = false
    this._isOnlyPending = false
    this._spyid = 0
    this._queueCount = 0
    this._tasksQueue = []

    this.resetMock(this._clearInterval)
    this.resetMock(this._clearTimeout)
    this.resetMock(this._setInterval)
    this.resetMock(this._setTimeout)
  }

  private runQueue() {
    let index = 0
    while (this._tasksQueue[index]) {
      assertMaxLoop(this._queueCount)

      const task = this._tasksQueue[index]

      const { call, nested, type } = task

      if (this._advancedTime && call.nestedMs > this._advancedTime)
        break

      if (this._isOnlyPending && nested) {
        index++
        continue
      }

      this._scopeId = call.id
      this._isNested = true

      this._nestedTime[call.id] ??= 0
      this._nestedTime[call.id] += call.ms

      if (type === 'timeout') {
        this.removeTask(index)
      }
      else if (type === 'interval') {
        call.nestedMs += call.ms
        const nestedMs = call.nestedMs
        const closestTask = this._tasksQueue.findIndex(({ type, call }) => type === 'interval' && call.nestedMs < nestedMs)

        if (closestTask !== -1 && closestTask !== index)
          this.ensureQueueOrder()
      }

      call.cb()

      this._queueCount++
    }
  }

  private removeTask(index: number) {
    if (index === 0)
      this._tasksQueue.shift()
    else
      this._tasksQueue.splice(index, 1)
  }

  private pushTask(task: QueueTask) {
    this._tasksQueue.push(task)
    this.ensureQueueOrder()
  }

  private ensureQueueOrder() {
    this._tasksQueue.sort((t1, t2) => {
      const diff = t1.call.nestedMs - t2.call.nestedMs

      if (diff === 0) {
        if (t1.type === QueueTaskType.Immediate && t2.type !== QueueTaskType.Immediate)
          return 1

        if (t1.type === QueueTaskType.Interval && t2.type !== QueueTaskType.Interval)
          return 1

        return 0
      }

      return diff
    })
  }

  private assertMocked() {
    assertEvery([
      this._isMocked,
      this._setTimeout,
      this._setInterval,
      this._clearTimeout,
      this._clearInterval,
    ], 'timers are not mocked. try calling "vitest.useFakeTimers()" first')
  }

  private resetMock(spy?: Spy) {
    spy?.reset()
    spy?.restore()
  }
}
