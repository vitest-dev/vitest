import type { BrowserCommand } from 'vitest/node'
import type { BrowserTraceEntry } from '../../types'
import type { BrowserServerState } from '../state'

interface MarkTracePayload {
  name: string
  stack?: string
  selector?: string
}

interface GroupTracePayload {
  name: string
  stack?: string
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    /**
     * @internal
     */
    __vitest_markTrace: (payload: MarkTracePayload) => Promise<void>
    /**
     * @internal
     */
    __vitest_groupTraceStart: (payload: GroupTracePayload) => Promise<void>
    /**
     * @internal
     */
    __vitest_groupTraceEnd: () => Promise<void>
    /**
     * @internal
     */
    __vitest_recordBrowserTrace: (payload: { testId: string; retry: number; repeats: number }) => Promise<void>
  }
}

export const _markTrace: BrowserCommand<[payload: MarkTracePayload]> = async (
  context,
  payload,
) => {
  if (context.provider.name === 'playwright') {
    await context.triggerCommand('__vitest_markTrace', payload)
  }
}

export const _groupTraceStart: BrowserCommand<[payload: GroupTracePayload]> = async (
  context,
  payload,
) => {
  if (context.provider.name === 'playwright') {
    await context.triggerCommand('__vitest_groupTraceStart', payload)
  }
}

export const _groupTraceEnd: BrowserCommand<[]> = async (
  context,
) => {
  if (context.provider.name === 'playwright') {
    await context.triggerCommand('__vitest_groupTraceEnd')
  }
}

export const _recordBrowserTrace: BrowserCommand<[payload: { testId: string; retry: number; repeats: number }]> = async (
  { project },
  { testId, retry, repeats },
) => {
  const state = project.browser!.state as BrowserServerState
  const key = `${testId}:${repeats}:${retry}`
  const buffered = state.streamedTraceEntries.get(key)
  if (!buffered) {
    return
  }
  state.streamedTraceEntries.delete(key)
  const entries: BrowserTraceEntry[] = buffered.entries.map((entry) => {
    if (!entry.stack || entry.location) {
      return entry
    }
    const stacks = project.browser!.parseStacktrace(entry.stack)
    if (stacks[0]) {
      entry.location = stacks[0]
    }
    return entry
  })
  await project.vitest._testRun.recordArtifact(testId, {
    type: 'internal:browserTrace',
    data: { retry: buffered.retry, repeats: buffered.repeats, recordCanvas: buffered.recordCanvas, entries },
  })
}
