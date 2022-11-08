import type { Awaitable, BenchFunction, BenchOptions, Benchmark, Suite, SuiteHooks, Test } from '../types'

// use WeakMap here to make the Test and Suite object serializable
const fnMap = new WeakMap()
const hooksMap = new WeakMap()
const benchOptsMap = new WeakMap()

export function setFn(key: Test | Benchmark, fn: (() => Awaitable<void>) | BenchFunction) {
  fnMap.set(key, fn)
}

export function getFn<Task = Test | Benchmark>(key: Task): Task extends Test ? (() => Awaitable<void>) : BenchFunction {
  return fnMap.get(key as any)
}

export function setHooks(key: Suite, hooks: SuiteHooks) {
  hooksMap.set(key, hooks)
}

export function getHooks(key: Suite): SuiteHooks {
  return hooksMap.get(key)
}

export function isTest(task: Test | Benchmark): task is Test {
  return task.type === 'test'
}

export function setBenchOptions(key: Benchmark, val: BenchOptions) {
  benchOptsMap.set(key, val)
}

export function getBenchOptions(key: Benchmark): BenchOptions {
  return benchOptsMap.get(key)
}
