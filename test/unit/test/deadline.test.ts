import { expect, test, vi } from 'vitest'
import { TaskDeadline } from '../../../packages/vitest/src/runtime/runner/deadline'

function noop() {}
const never = new Promise<never>(noop)

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

test('derive keeps a buffer before the task deadline and stays positive', () => {
  const deadline = new TaskDeadline(1000, noop)
  expect(deadline.derive()).toBeLessThanOrEqual(900)
  expect(deadline.derive()).toBeGreaterThan(850)
  deadline.clear()

  const short = new TaskDeadline(50, noop)
  expect(short.derive()).toBe(1)
  short.clear()
})

test('the timer calls onTimeout unless cleared', async () => {
  const cleared = vi.fn()
  const fired = vi.fn()
  const deadline = new TaskDeadline(20, cleared)
  deadline.clear()
  const running = new TaskDeadline(20, fired)
  await sleep(60)
  running.clear()
  expect(cleared).not.toHaveBeenCalled()
  expect(fired).toHaveBeenCalledOnce()
})

test('settle has nothing to wait for without operations', () => {
  const deadline = new TaskDeadline(100, noop)
  expect(deadline.settle()).toBeUndefined()
  deadline.clear()
})

test('settle reports an operation due after the task right away', async () => {
  const deadline = new TaskDeadline(100, noop)
  deadline.track('click', never, 5000)
  const pending = await deadline.settle()
  expect.assert(pending)
  expect(pending.map(operation => operation.name)).toEqual(['click'])
  deadline.clear()
})

test('settle rejects with the error of a failed operation', async () => {
  const deadline = new TaskDeadline(100, noop)
  const failed = Promise.reject(new Error('slow click'))
  failed.catch(noop)
  deadline.track('click', failed, 10)
  await expect(deadline.settle()).rejects.toThrow('slow click')
  deadline.clear()
})

test('settle resolves with nothing pending once operations finish', async () => {
  const deadline = new TaskDeadline(100, noop)
  let finish!: () => void
  deadline.track('click', new Promise<void>(resolve => finish = resolve), 10)
  const settled = deadline.settle()
  finish()
  await expect(settled).resolves.toEqual([])
  deadline.clear()
})

test('settle reports operations that did not report back within the grace', async () => {
  const deadline = new TaskDeadline(100, noop)
  const source = new Error('STACK_TRACE_ERROR')
  deadline.track('click', never, 10, source)
  deadline.track('screenshot', never, 5000)
  const pending = await deadline.settle()
  expect.assert(pending)
  expect(pending.map(operation => operation.name)).toEqual(['click', 'screenshot'])
  expect(pending[0].source).toBe(source)
  deadline.clear()
})

test('exceeded reflects the task deadline', async () => {
  const deadline = new TaskDeadline(20, noop)
  expect(deadline.exceeded()).toBe(false)
  await sleep(40)
  expect(deadline.exceeded()).toBe(true)
  deadline.clear()
})
