import type { Awaitable } from '@vitest/utils'
import type { VitestRunner } from './types/runner'
import type {
  File,
  RuntimeContext,
  SuiteCollector,
  Test,
  TestAnnotation,
  TestAnnotationLocation,
  TestAttachment,
  TestContext,
  WriteableTestContext,
} from './types/tasks'
import { getSafeTimers } from '@vitest/utils'
import { parseSingleStack } from '@vitest/utils/source-map'
import { PendingError } from './errors'
import { finishSendTasksUpdate } from './run'
import { getRunner } from './suite'

const now = Date.now

export const collectorContext: RuntimeContext = {
  tasks: [],
  currentSuite: null,
}

export function collectTask(task: SuiteCollector): void {
  collectorContext.currentSuite?.tasks.push(task)
}

export async function runWithSuite(
  suite: SuiteCollector,
  fn: () => Awaitable<void>,
): Promise<void> {
  const prev = collectorContext.currentSuite
  collectorContext.currentSuite = suite
  await fn()
  collectorContext.currentSuite = prev
}

export function withTimeout<T extends (...args: any[]) => any>(
  fn: T,
  timeout: number,
  isHook = false,
  stackTraceError?: Error,
  onTimeout?: (args: T extends (...args: infer A) => any ? A : never, error: Error) => void,
): T {
  if (timeout <= 0 || timeout === Number.POSITIVE_INFINITY) {
    return fn
  }

  const { setTimeout, clearTimeout } = getSafeTimers()

  // this function name is used to filter error in test/cli/test/fails.test.ts
  return (function runWithTimeout(...args: T extends (...args: infer A) => any ? A : never) {
    const startTime = now()
    const runner = getRunner()
    runner._currentTaskStartTime = startTime
    runner._currentTaskTimeout = timeout
    return new Promise((resolve_, reject_) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        rejectTimeoutError()
      }, timeout)
      // `unref` might not exist in browser
      timer.unref?.()

      function rejectTimeoutError() {
        const error = makeTimeoutError(isHook, timeout, stackTraceError)
        onTimeout?.(args, error)
        reject_(error)
      }

      function resolve(result: unknown) {
        runner._currentTaskStartTime = undefined
        runner._currentTaskTimeout = undefined
        clearTimeout(timer)
        // if test/hook took too long in microtask, setTimeout won't be triggered,
        // but we still need to fail the test, see
        // https://github.com/vitest-dev/vitest/issues/2920
        if (now() - startTime >= timeout) {
          rejectTimeoutError()
          return
        }
        resolve_(result)
      }

      function reject(error: unknown) {
        runner._currentTaskStartTime = undefined
        runner._currentTaskTimeout = undefined
        clearTimeout(timer)
        reject_(error)
      }

      // sync test/hook will be caught by try/catch
      try {
        const result = fn(...args) as PromiseLike<unknown>
        // the result is a thenable, we don't wrap this in Promise.resolve
        // to avoid creating new promises
        if (typeof result === 'object' && result != null && typeof result.then === 'function') {
          result.then(resolve, reject)
        }
        else {
          resolve(result)
        }
      }
      // user sync test/hook throws an error
      catch (error) {
        reject(error)
      }
    })
  }) as T
}

const abortControllers = new WeakMap<TestContext, AbortController>()

export function abortIfTimeout([context]: [TestContext?], error: Error): void {
  if (context) {
    abortContextSignal(context, error)
  }
}

export function abortContextSignal(context: TestContext, error: Error): void {
  const abortController = abortControllers.get(context)
  abortController?.abort(error)
}

export function createTestContext(
  test: Test,
  runner: VitestRunner,
): TestContext {
  const context = function () {
    throw new Error('done() callback is deprecated, use promise instead')
  } as unknown as WriteableTestContext

  let abortController = abortControllers.get(context)

  if (!abortController) {
    abortController = new AbortController()
    abortControllers.set(context, abortController)
  }

  context.signal = abortController.signal
  context.task = test

  context.skip = (condition?: boolean | string, note?: string): never => {
    if (condition === false) {
      // do nothing
      return undefined as never
    }
    test.result ??= { state: 'skip' }
    test.result.pending = true
    throw new PendingError(
      'test is skipped; abort execution',
      test,
      typeof condition === 'string' ? condition : note,
    )
  }

  async function annotate(
    message: string,
    location?: TestAnnotationLocation,
    type?: string,
    attachment?: TestAttachment,
  ) {
    const annotation: TestAnnotation = {
      message,
      type: type || 'notice',
    }
    if (attachment) {
      if (!attachment.body && !attachment.path) {
        throw new TypeError(`Test attachment requires body or path to be set. Both are missing.`)
      }
      if (attachment.body && attachment.path) {
        throw new TypeError(`Test attachment requires only one of "body" or "path" to be set. Both are specified.`)
      }
      annotation.attachment = attachment
      // convert to a string so it's easier to serialise
      if (attachment.body instanceof Uint8Array) {
        attachment.body = encodeUint8Array(attachment.body)
      }
    }
    if (location) {
      annotation.location = location
    }

    if (!runner.onTestAnnotate) {
      throw new Error(`Test runner doesn't support test annotations.`)
    }

    await finishSendTasksUpdate(runner)

    const resolvedAnnotation = await runner.onTestAnnotate(test, annotation)
    test.annotations.push(resolvedAnnotation)
    return resolvedAnnotation
  }

  context.annotate = ((message, type, attachment) => {
    if (test.result && test.result.state !== 'run') {
      throw new Error(`Cannot annotate tests outside of the test run. The test "${test.name}" finished running with the "${test.result.state}" state already.`)
    }

    let location: undefined | TestAnnotationLocation

    const stack = new Error('STACK_TRACE').stack!
    const index = stack.includes('STACK_TRACE') ? 2 : 1
    const stackLine = stack.split('\n')[index]
    const parsed = parseSingleStack(stackLine)
    if (parsed) {
      location = {
        file: parsed.file,
        line: parsed.line,
        column: parsed.column,
      }
    }

    if (typeof type === 'object') {
      return recordAsyncAnnotation(
        test,
        annotate(message, location, undefined, type),
      )
    }
    else {
      return recordAsyncAnnotation(
        test,
        annotate(message, location, type, attachment),
      )
    }
  }) as TestContext['annotate']

  context.onTestFailed = (handler, timeout) => {
    test.onFailed ||= []
    test.onFailed.push(
      withTimeout(
        handler,
        timeout ?? runner.config.hookTimeout,
        true,
        new Error('STACK_TRACE_ERROR'),
        (_, error) => abortController.abort(error),
      ),
    )
  }

  context.onTestFinished = (handler, timeout) => {
    test.onFinished ||= []
    test.onFinished.push(
      withTimeout(
        handler,
        timeout ?? runner.config.hookTimeout,
        true,
        new Error('STACK_TRACE_ERROR'),
        (_, error) => abortController.abort(error),
      ),
    )
  }

  return runner.extendTaskContext?.(context) || context
}

function makeTimeoutError(isHook: boolean, timeout: number, stackTraceError?: Error) {
  const message = `${
    isHook ? 'Hook' : 'Test'
  } timed out in ${timeout}ms.\nIf this is a long-running ${
    isHook ? 'hook' : 'test'
  }, pass a timeout value as the last argument or configure it globally with "${
    isHook ? 'hookTimeout' : 'testTimeout'
  }".`
  const error = new Error(message)
  if (stackTraceError?.stack) {
    error.stack = stackTraceError.stack.replace(error.message, stackTraceError.message)
  }
  return error
}

const fileContexts = new WeakMap<File, Record<string, unknown>>()

export function getFileContext(file: File): Record<string, unknown> {
  const context = fileContexts.get(file)
  if (!context) {
    throw new Error(`Cannot find file context for ${file.name}`)
  }
  return context
}

export function setFileContext(file: File, context: Record<string, unknown>): void {
  fileContexts.set(file, context)
}

const table: string[] = []
for (let i = 65; i < 91; i++) {
  table.push(String.fromCharCode(i))
}
for (let i = 97; i < 123; i++) {
  table.push(String.fromCharCode(i))
}
for (let i = 0; i < 10; i++) {
  table.push(i.toString(10))
}

function encodeUint8Array(bytes: Uint8Array): string {
  let base64 = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i += 3) {
    if (len === i + 1) { // last 1 byte
      const a = (bytes[i] & 0xFC) >> 2
      const b = ((bytes[i] & 0x03) << 4)
      base64 += table[a]
      base64 += table[b]
      base64 += '=='
    }
    else if (len === i + 2) { // last 2 bytes
      const a = (bytes[i] & 0xFC) >> 2
      const b = ((bytes[i] & 0x03) << 4) | ((bytes[i + 1] & 0xF0) >> 4)
      const c = ((bytes[i + 1] & 0x0F) << 2)
      base64 += table[a]
      base64 += table[b]
      base64 += table[c]
      base64 += '='
    }
    else {
      const a = (bytes[i] & 0xFC) >> 2
      const b = ((bytes[i] & 0x03) << 4) | ((bytes[i + 1] & 0xF0) >> 4)
      const c = ((bytes[i + 1] & 0x0F) << 2) | ((bytes[i + 2] & 0xC0) >> 6)
      const d = bytes[i + 2] & 0x3F
      base64 += table[a]
      base64 += table[b]
      base64 += table[c]
      base64 += table[d]
    }
  }
  return base64
}

function recordAsyncAnnotation<T>(
  test: Test,
  promise: Promise<T>,
): Promise<T> {
  // if promise is explicitly awaited, remove it from the list
  promise = promise.finally(() => {
    if (!test.promises) {
      return
    }
    const index = test.promises.indexOf(promise)
    if (index !== -1) {
      test.promises.splice(index, 1)
    }
  })

  // record promise
  if (!test.promises) {
    test.promises = []
  }
  test.promises.push(promise)
  return promise
}
