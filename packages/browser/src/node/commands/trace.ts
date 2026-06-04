import type { BrowserCommand } from 'vitest/node'
import type { SerializedLocator } from '..'
import type { BrowserTraceData, BrowserTraceEntry } from '../../client/tester/trace'

interface MarkTracePayload {
  name: string
  stack?: string
  element?: SerializedLocator
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
    __vitest_recordBrowserTrace: (payload: { testId: string; data: BrowserTraceData }) => Promise<void>
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

export const _recordBrowserTrace: BrowserCommand<[payload: { testId: string; data: BrowserTraceData }]> = async (
  { project },
  { testId, data },
) => {
  // resolve stack strings → source locations server-side (requires source maps)
  const entries: BrowserTraceEntry[] = data.entries.map((entry) => {
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
    data: { ...data, entries },
  })
}
