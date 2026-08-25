import type { Page } from 'playwright'
import type { TestContext } from 'vitest'
import type { MarkOptions } from 'vitest/browser'
// @ts-ignore
import { parseStacktrace } from '@vitest/utils/source-map'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createRequire } from 'node:module'
import { recordArtifact, vi } from 'vitest'

const require = createRequire(import.meta.url)
const rrwebSnapshotPath = require.resolve('rrweb-snapshot')

export interface TraceAttempt {
  retry: number
  repeats: number
  startTime: number
}

export interface SnapshotOptions extends MarkOptions {
  location?: {
    file: string
    line: number
    column: number
  }
  status?: 'pass' | 'fail'
}

interface SnapshotEntryOptions extends SnapshotOptions {
  range?: {
    id: string
    phase: 'start' | 'end'
  }
}

interface ApiCallData {
  apiName?: string
  error?: Error
  frames: Array<{
    file: string
    line: number
    column: number
  }>
}

interface ApiCallChannel {
  method: string
  params?: Record<string, unknown>
  type: string
}

interface ApiCallState {
  apiName?: string
  data?: ApiCallData
  location?: SnapshotOptions['location']
}

interface CapturedSnapshot {
  snapshot: unknown
  startTime: number
}

export interface TraceRecorder {
  assert: <T>(name: string, body: () => T | Promise<T>, options?: SnapshotOptions) => Promise<T>
  finish: () => Promise<void>
  snapshot: (name: string, options?: SnapshotOptions) => Promise<void>
  mark: {
    (name: string, options?: MarkOptions): Promise<void>
    <T>(name: string, body: () => T | Promise<T>, options?: MarkOptions): Promise<T>
  }
}

export async function createTraceRecorder(
  page: Page,
  task: TestContext['task'],
  attempt: TraceAttempt,
): Promise<TraceRecorder> {
  const apiCallStorage = new AsyncLocalStorage<'internal' | ApiCallState>()
  const instrumentation = (page as any)._instrumentation
  const apiCallOwner = findApiCallOwner(page)
  const originalWrapApiCall = apiCallOwner._wrapApiCall
  let internalCallDepth = 0
  let finished = false

  const runInternal = async <T>(body: () => T | Promise<T>): Promise<T> => {
    internalCallDepth += 1
    try {
      return await apiCallStorage.run('internal', body)
    }
    finally {
      internalCallDepth -= 1
    }
  }

  async function captureSnapshot(): Promise<CapturedSnapshot> {
    const startTime = performance.now() - attempt.startTime
    return runInternal(async () => {
      const snapshotReady = await page.evaluate(() => !!(globalThis as any).rrwebSnapshot)
      if (!snapshotReady) {
        await page.addScriptTag({ path: rrwebSnapshotPath })
      }
      const snapshot = await page.evaluate(() => {
        const { snapshot } = (globalThis as any).rrwebSnapshot
        const serialized = snapshot(document)
        if (!serialized) {
          throw new Error('Failed to serialize document')
        }
        return {
          serialized,
          viewport: {
            width: globalThis.innerWidth,
            height: globalThis.innerHeight,
          },
          scroll: {
            x: globalThis.scrollX,
            y: globalThis.scrollY,
          },
          pseudoClassIds: {},
        }
      })
      return { snapshot, startTime }
    })
  }

  async function recordCapturedSnapshot(
    name: string,
    captured: CapturedSnapshot,
    options: SnapshotEntryOptions = {},
  ): Promise<void> {
    const stackLocation = options.stack ? parseStacktrace(options.stack)[0] : undefined
    const location = options.location ?? (stackLocation
      ? {
          file: stackLocation.file,
          line: stackLocation.line,
          column: stackLocation.column,
        }
      : undefined)
    await recordArtifact(task, {
      type: 'internal:browserTrace',
      data: {
        retry: attempt.retry,
        repeats: attempt.repeats,
        recordCanvas: false,
        entries: [{
          name,
          kind: options.kind ?? 'mark',
          startTime: captured.startTime,
          snapshot: captured.snapshot,
          ...(options.range ? { range: options.range } : {}),
          ...(options.status ? { status: options.status } : {}),
          ...(location ? { location } : {}),
        }],
      },
    })
  }

  async function recordSnapshot(name: string, options: SnapshotEntryOptions = {}): Promise<void> {
    await recordCapturedSnapshot(name, await captureSnapshot(), options)
  }

  const apiCallListener = {
    onApiCallBegin(data: ApiCallData, channel: ApiCallChannel) {
      const state = apiCallStorage.getStore()
      if (state && state !== 'internal') {
        state.data = data
        state.apiName ??= getApiCallName(channel)
      }
    },
  }

  instrumentation.addListener(apiCallListener)
  // Spike only: Playwright does not expose an awaited API-call instrumentation hook.
  apiCallOwner._wrapApiCall = async function <T>(
    body: (zone: unknown) => Promise<T>,
    options?: { internal?: boolean; title?: string },
  ): Promise<T> {
    if (options?.internal || internalCallDepth || apiCallStorage.getStore()) {
      return originalWrapApiCall.call(this, body, options)
    }

    const stack = new Error().stack
    const apiName = inferApiName(stack)
    const state: ApiCallState = {
      apiName,
      location: findUserLocation(stack),
    }
    return apiCallStorage.run(state, async () => {
      const startSnapshot = await captureSnapshot()
      let status: 'pass' | 'fail' = 'pass'
      try {
        return await originalWrapApiCall.call(
          this,
          body,
          apiName ? { ...options, title: apiName } : options,
        )
      }
      catch (error) {
        status = 'fail'
        throw error
      }
      finally {
        const recordedName = state.apiName ?? state.data?.apiName
        if (recordedName) {
          const endSnapshot = await captureSnapshot()
          const rangeId = Math.random().toString(36).slice(2)
          const frame = state.data?.frames[0]
          const location = state.location ?? (frame
            ? { file: frame.file, line: frame.line, column: frame.column }
            : undefined)
          await recordCapturedSnapshot(recordedName, startSnapshot, {
            kind: 'action',
            location,
            range: { id: rangeId, phase: 'start' },
          })
          await recordCapturedSnapshot(recordedName, endSnapshot, {
            kind: 'action',
            location,
            range: { id: rangeId, phase: 'end' },
            status,
          })
        }
      }
    })
  }

  const finish = async (): Promise<void> => {
    if (finished) {
      return
    }
    finished = true
    apiCallOwner._wrapApiCall = originalWrapApiCall
    instrumentation.removeListener(apiCallListener)
    const status = task.result?.state
    const stack = status === 'fail' ? task.result?.errors?.[0].stack : undefined
    const location = task.location
      ? { ...task.location, file: task.file.filepath }
      : undefined
    await recordSnapshot('vitest:onAfterRetryTask', {
      kind: 'lifecycle',
      ...(status === 'pass' || status === 'fail' ? { status } : {}),
      ...(stack ? { stack } : location ? { location } : {}),
    })
  }

  const assert = async <T>(
    name: string,
    body: () => T | Promise<T>,
    options?: SnapshotOptions,
  ): Promise<T> => {
    const rangeId = Math.random().toString(36).slice(2)
    await recordSnapshot(name, {
      ...options,
      kind: 'expect',
      range: { id: rangeId, phase: 'start' },
    })

    let status: 'pass' | 'fail' = 'pass'
    try {
      return await runInternal(body)
    }
    catch (error) {
      status = 'fail'
      throw error
    }
    finally {
      await recordSnapshot(name, {
        ...options,
        kind: 'expect',
        range: { id: rangeId, phase: 'end' },
        status,
      })
    }
  }

  const mark: TraceRecorder['mark'] = async <T>(
    name: string,
    bodyOrOptions?: MarkOptions | (() => T | Promise<T>),
    options?: MarkOptions,
  ): Promise<T | void> => {
    if (typeof bodyOrOptions !== 'function') {
      return recordSnapshot(name, bodyOrOptions)
    }

    const rangeId = Math.random().toString(36).slice(2)
    await recordSnapshot(name, {
      ...options,
      kind: 'mark',
      range: { id: rangeId, phase: 'start' },
    })

    let status: 'pass' | 'fail' = 'pass'
    try {
      return await bodyOrOptions()
    }
    catch (error) {
      status = 'fail'
      throw error
    }
    finally {
      await recordSnapshot(name, {
        ...options,
        kind: options?.kind,
        range: { id: rangeId, phase: 'end' },
        status,
      })
    }
  }

  return {
    assert,
    finish,
    snapshot: vi.defineHelper(recordSnapshot),
    mark: vi.defineHelper(mark),
  }
}

function findApiCallOwner(page: Page): any {
  let prototype = page as any
  while (prototype && !Object.hasOwn(prototype, '_wrapApiCall')) {
    prototype = Object.getPrototypeOf(prototype)
  }
  if (!prototype) {
    throw new Error('Playwright ChannelOwner._wrapApiCall was not found')
  }
  return prototype
}

function inferApiName(stack: string | undefined): string | undefined {
  let pageMethod: string | undefined
  for (const line of stack?.split('\n') ?? []) {
    const match = line.match(/at _?(Locator|Page|Frame)\.([^ ]+)/)
    if (!match || match[2].startsWith('_') || match[2].includes('._')) {
      continue
    }
    if (match[1] === 'Locator') {
      return `locator.${match[2]}`
    }
    pageMethod ??= `page.${match[2]}`
  }
  return pageMethod
}

function findUserLocation(stack: string | undefined): SnapshotOptions['location'] {
  const frame = parseStacktrace(stack ?? '').find(({ file }) => {
    return !file.includes('/node_modules/') && !file.includes('/trace/')
  })
  return frame
    ? { file: frame.file, line: frame.line, column: frame.column }
    : undefined
}

function getApiCallName(channel: ApiCallChannel): string {
  const method = channel.method === 'evaluateExpression' ? 'evaluate' : channel.method
  if (typeof channel.params?.selector === 'string') {
    return `locator.${method}`
  }
  if (channel.type === 'Frame') {
    return `page.${method}`
  }
  return `${channel.type.charAt(0).toLowerCase()}${channel.type.slice(1)}.${method}`
}
