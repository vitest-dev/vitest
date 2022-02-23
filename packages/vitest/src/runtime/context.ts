import type { Awaitable, DoneCallback, RuntimeContext, SuiteCollector, TestFunction } from '../types'

export const context: RuntimeContext = {
  tasks: [],
  currentSuite: null,
}

export function collectTask(task: SuiteCollector) {
  context.currentSuite?.tasks.push(task)
}

export async function runWithSuite(suite: SuiteCollector, fn: (() => Awaitable<void>)) {
  const prev = context.currentSuite
  context.currentSuite = suite
  await fn()
  context.currentSuite = prev
}

export function getDefaultTestTimeout() {
  return __vitest_worker__!.config!.testTimeout
}

export function getDefaultHookTimeout() {
  return __vitest_worker__!.config!.hookTimeout
}

export function withTimeout<T extends((...args: any[]) => any)>(
  fn: T,
  timeout = getDefaultTestTimeout(),
  isHook = false,
): T {
  if (timeout <= 0 || timeout === Infinity)
    return fn

  return ((...args: (T extends ((...args: infer A) => any) ? A : never)) => {
    return Promise.race([fn(...args), new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error(makeTimeoutMsg(isHook, timeout)))
      }, timeout)
      timer.unref()
    })]) as Awaitable<void>
  }) as T
}

function makeTimeoutMsg(isHook: boolean, timeout: number) {
  return `${isHook ? 'Hook' : 'Test'} timed out in ${timeout}ms.\nIf this is a long-running test, pass a timeout value as the last argument or configure it globally with "${isHook ? 'hookTimeout' : 'testTimeout'}".`
}

function ensureAsyncTest(fn: TestFunction): () => Awaitable<void> {
  if (!fn.length)
    return fn as () => Awaitable<void>

  return () => new Promise((resolve, reject) => {
    const done: DoneCallback = (...args: any[]) => args[0] // reject on truthy values
      ? reject(args[0])
      : resolve()
    fn(done)
  })
}

export function normalizeTest(fn: TestFunction, timeout?: number): () => Awaitable<void> {
  return withTimeout(ensureAsyncTest(fn), timeout)
}
