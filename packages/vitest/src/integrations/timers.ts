// TODO setImmediate, nextTick, requestAnimationFrame, cancelAnimationFrame
// TODO async timers

import type { SpyInstance } from './jest-mock'
import { spyOn } from './jest-mock'

const originalSetTimeout = global.setTimeout
const originalSetInterval = global.setInterval
const originalClearTimeout = global.clearTimeout
const originalClearInterval = global.clearInterval

type Arguments = [cb: (args: void) => void, ms?: number | undefined]

const MAX_LOOPS = 10_000

interface FakeCall {
  cb: () => any
  ms: number
  id: number
  nestedMs: number
  scopeId: number
}

enum QueueTaskType {
  Interval = 'interval',
  Timeout = 'timeout',
  Immediate = 'immediate',
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

// TODO should do what NodeJS.Timeout does on refresh
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
  private _setTimeout!: SpyInstance<Arguments, NodeJS.Timeout>
  private _setInterval!: SpyInstance<Arguments, NodeJS.Timeout>

  private _clearTimeout!: SpyInstance<[NodeJS.Timeout], void>
  private _clearInterval!: SpyInstance<[NodeJS.Timeout], void>

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
        // all timers up until this point
        const nestedTo = Object.entries(this._nestedTime).filter(([key]) => Number(key) <= this._scopeId)
        const nestedMs = nestedTo.reduce((total, [, ms]) => total + ms, ms)
        const call: FakeCall = { id, cb, ms, nestedMs, scopeId: this._scopeId }
        const task = { type: spyType, call, nested: this._isNested }

        this.pushTask(task)

        return resultBuilder(id, cb)
      }
    }

    this._setTimeout = spyOn(global, 'setTimeout').mockImplementation(spyFactory(QueueTaskType.Timeout, getNodeTimeout))
    this._setInterval = spyOn(global, 'setInterval').mockImplementation(spyFactory(QueueTaskType.Interval, getNodeTimeout))

    const clearTimerFactory = (spyType: QueueTaskType) => (id: number | undefined | NodeJS.Timeout) => {
      if (id === undefined) return

      const index = this._tasksQueue.findIndex(({ call, type }) => type === spyType && call.id === Number(id))

      if (index !== -1)
        this._tasksQueue.splice(index, 1)
    }

    this._clearTimeout = spyOn(global, 'clearTimeout').mockImplementation(clearTimerFactory(QueueTaskType.Timeout))
    this._clearInterval = spyOn(global, 'clearInterval').mockImplementation(clearTimerFactory(QueueTaskType.Interval))
  }

  public useRealTimers() {
    this._isMocked = false

    this.reset()

    global.setTimeout = originalSetTimeout
    global.setInterval = originalSetInterval
    global.clearTimeout = originalClearTimeout
    global.clearInterval = originalClearInterval
  }

  public runOnlyPendingTimers(): void | Promise<void> {
    this.assertMocked()

    this._isOnlyPending = true
    this.runQueue()
  }

  public runAllTimers(): void | Promise<void> {
    this.assertMocked()

    this.runQueue()
  }

  public advanceTimersByTime(ms: number): void | Promise<void> {
    this.assertMocked()

    this._advancedTime += ms
    this.runQueue()
  }

  public advanceTimersToNextTimer(): void | Promise<void> {
    this.assertMocked()

    this.callQueueItem(0)
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

    this._clearInterval?.mockRestore()
    this._clearTimeout?.mockRestore()
    this._setInterval?.mockRestore()
    this._setTimeout?.mockRestore()
  }

  private callQueueItem(index: number) {
    const task = this._tasksQueue[index]

    if (!task) return

    const { call, type } = task

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

  private runQueue() {
    let index = 0
    while (this._tasksQueue[index]) {
      assertMaxLoop(this._queueCount)

      const { call, nested } = this._tasksQueue[index]

      if (this._advancedTime && call.nestedMs > this._advancedTime)
        break

      if (this._isOnlyPending && nested) {
        index++
        continue
      }

      this.callQueueItem(index)
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
    ], 'timers are not mocked. try calling "vi.useFakeTimers()" first')
  }
}
