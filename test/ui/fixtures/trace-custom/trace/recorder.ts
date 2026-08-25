import type { Page } from 'playwright'
import type { TestContext } from 'vitest'
import type { MarkOptions } from 'vitest/browser'
import { createRequire } from 'node:module'
import { recordArtifact, vi } from 'vitest'

const require = createRequire(import.meta.url)
const rrwebSnapshotPath = require.resolve('rrweb-snapshot')

export interface TraceAttempt {
  retry: number
  repeats: number
  startTime: number
}

interface SnapshotEntryOptions extends MarkOptions {
  range?: {
    id: string
    phase: 'start' | 'end'
  }
  status?: 'pass' | 'fail'
}

export interface TraceRecorder {
  snapshot: (name: string, options?: MarkOptions) => Promise<void>
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
  await page.addScriptTag({ path: rrwebSnapshotPath })

  async function recordSnapshot(name: string, options: SnapshotEntryOptions = {}): Promise<void> {
    const startTime = performance.now() - attempt.startTime
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

    await recordArtifact(task, {
      type: 'internal:browserTrace',
      data: {
        retry: attempt.retry,
        repeats: attempt.repeats,
        recordCanvas: false,
        entries: [{
          name,
          kind: options.kind ?? 'mark',
          startTime,
          snapshot,
          ...(options.range ? { range: options.range } : {}),
          ...(options.status ? { status: options.status } : {}),
          ...(options.stack ? { stack: options.stack } : {}),
        }],
      },
    })
  }

  const snapshot = vi.defineHelper(recordSnapshot)
  const mark = vi.defineHelper(async <T>(
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
  }) as TraceRecorder['mark']

  return {
    snapshot,
    mark,
  }
}
