import type { BrowserCommand } from 'vitest/node'

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
